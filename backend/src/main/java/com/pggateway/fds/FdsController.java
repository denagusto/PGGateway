package com.pggateway.fds;

import com.pggateway.audit.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Fraud alert API for the portal. */
@RestController
@RequestMapping("/api/alerts")
public class FdsController {

    private final AlertStore store;
    private final AuditService audit;

    public FdsController(AlertStore store, AuditService audit) {
        this.store = store;
        this.audit = audit;
    }

    /** ?status=OPEN|CONFIRMED_FRAUD|FALSE_POSITIVE (default OPEN), ?limit=N. */
    @GetMapping
    public List<Alert> list(@RequestParam(defaultValue = "OPEN") String status,
                            @RequestParam(defaultValue = "50") int limit) {
        AlertStatus filter = "ALL".equalsIgnoreCase(status) ? null : AlertStatus.valueOf(status.toUpperCase());
        return store.list(filter, limit);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Alert> get(@PathVariable String id) {
        return store.get(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
    }

    /** body: {"verdict": "confirm_fraud" | "false_positive"} */
    @PostMapping("/{id}/verdict")
    public ResponseEntity<Alert> verdict(@PathVariable String id, @RequestBody VerdictRequest req) {
        AlertStatus v;
        if ("confirm_fraud".equalsIgnoreCase(req.verdict())) v = AlertStatus.CONFIRMED_FRAUD;
        else if ("false_positive".equalsIgnoreCase(req.verdict())) v = AlertStatus.FALSE_POSITIVE;
        else return ResponseEntity.badRequest().build();
        java.util.Optional<Alert> updated = store.setVerdict(id, v);
        if (updated.isEmpty()) return ResponseEntity.notFound().build();
        audit.append("alert.verdict", id, v.name());
        return ResponseEntity.ok(updated.get());
    }

    public record VerdictRequest(String verdict) {}
}
