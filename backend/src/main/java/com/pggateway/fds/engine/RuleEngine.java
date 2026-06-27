package com.pggateway.fds.engine;

import com.pggateway.fds.rules.Rule;
import com.pggateway.fds.rules.RuleStore;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Evaluates the dynamic {@link Rule} set against a feature map (SpEL formulas). Returns the
 * enabled rules whose expression is true for this transaction.
 *
 * SECURITY: uses StandardEvaluationContext, which allows method calls. Rule editing is for
 * trusted compliance admins only. Before exposing rule editing to untrusted users, switch to
 * a sandboxed SimpleEvaluationContext (read-only data binding) — tracked as a follow-up.
 */
@Component
public class RuleEngine {

    private final RuleStore store;
    private final ExpressionParser parser = new SpelExpressionParser();
    private final Map<String, Expression> cache = new ConcurrentHashMap<>();

    public RuleEngine(RuleStore store) {
        this.store = store;
    }

    /** Rules (enabled) whose formula is true for these features. */
    public List<Rule> evaluate(Map<String, Object> features) {
        StandardEvaluationContext ctx = new StandardEvaluationContext();
        features.forEach(ctx::setVariable);
        List<Rule> fired = new ArrayList<>();
        for (Rule r : store.all()) {
            if (!r.enabled()) continue;
            try {
                Expression exp = cache.computeIfAbsent(r.expression(), parser::parseExpression);
                if (Boolean.TRUE.equals(exp.getValue(ctx, Boolean.class))) {
                    fired.add(r);
                }
            } catch (Exception ex) {
                // a malformed rule must never crash the pipeline — skip it
            }
        }
        return fired;
    }

    /** Whether an expression parses (for validating rule create/update). */
    public boolean valid(String expression) {
        try {
            parser.parseExpression(expression);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
