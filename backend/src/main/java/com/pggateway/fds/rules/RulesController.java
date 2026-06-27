package com.pggateway.fds.rules;

import com.pggateway.audit.AuditService;
import com.pggateway.fds.engine.RuleEngine;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * CRUD for the dynamic rule set — the FDS Rules screen talks to this. Add / edit / delete /
 * toggle rules at runtime. Expressions are validated (must parse) before being saved.
 */
@RestController
@RequestMapping("/api/rules")
public class RulesController {

    private final RuleStore store;
    private final RuleEngine engine;
    private final AuditService audit;

    public RulesController(RuleStore store, RuleEngine engine, AuditService audit) {
        this.store = store;
        this.engine = engine;
        this.audit = audit;
    }

    @GetMapping
    public List<Rule> all() {
        return store.all();
    }

    @GetMapping("/{id}")
    public ResponseEntity<Rule> get(@PathVariable String id) {
        return store.get(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Rule rule) {
        if (rule.expression() == null || !engine.valid(rule.expression())) {
            return ResponseEntity.badRequest().body(Map.of("error", "formula tidak valid (SpEL)"));
        }
        Rule created = store.create(rule);
        audit.append("rule.create", created.id(), created.name());
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> patch) {
        if (patch.containsKey("expression") && !engine.valid(String.valueOf(patch.get("expression")))) {
            return ResponseEntity.badRequest().body(Map.of("error", "formula tidak valid (SpEL)"));
        }
        java.util.Optional<Rule> r = store.update(id, patch);
        if (r.isEmpty()) return ResponseEntity.notFound().build();
        audit.append("rule.update", id, "");
        return ResponseEntity.ok(r.get());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        boolean deleted = store.delete(id);
        if (deleted) audit.append("rule.delete", id, "");
        return deleted ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
