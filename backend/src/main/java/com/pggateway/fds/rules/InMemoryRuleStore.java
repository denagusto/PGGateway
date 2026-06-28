package com.pggateway.fds.rules;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory rule store (default profile). Seeded with the PPATK-aligned defaults. */
@Component
@Profile("!cockroach")
public class InMemoryRuleStore implements RuleStore {

    private final Map<String, Rule> rules = new ConcurrentHashMap<>();
    private final List<String> order = new ArrayList<>(); // preserve display order
    private final AtomicLong seq = new AtomicLong();

    public InMemoryRuleStore() {
        for (Rule r : RuleStore.defaults()) {
            rules.put(r.id(), r);
            order.add(r.id());
        }
    }

    @Override
    public List<Rule> all() {
        List<Rule> out = new ArrayList<>();
        synchronized (order) {
            for (String id : order) {
                Rule r = rules.get(id);
                if (r != null) out.add(r);
            }
        }
        return out;
    }

    @Override
    public Optional<Rule> get(String id) {
        return Optional.ofNullable(rules.get(id));
    }

    @Override
    public Rule create(Rule r) {
        String id = (r.id() == null || r.id().isBlank()) ? "rule_" + seq.incrementAndGet() : r.id();
        Rule created = new Rule(id, r.name(), RuleStore.nz(r.report()), r.enabled(), r.score(), r.expression());
        rules.put(id, created);
        synchronized (order) {
            if (!order.contains(id)) order.add(id);
        }
        return created;
    }

    @Override
    public Optional<Rule> update(String id, Map<String, Object> patch) {
        Rule cur = rules.get(id);
        if (cur == null) return Optional.empty();
        Rule updated = RuleStore.merge(cur, patch);
        rules.put(id, updated);
        return Optional.of(updated);
    }

    @Override
    public boolean delete(String id) {
        boolean existed = rules.remove(id) != null;
        synchronized (order) {
            order.remove(id);
        }
        return existed;
    }
}
