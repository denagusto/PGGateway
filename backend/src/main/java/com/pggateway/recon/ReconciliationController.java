package com.pggateway.recon;

import com.pggateway.audit.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Reconciliation API for the portal. */
@RestController
@RequestMapping("/api/reconciliation")
public class ReconciliationController {

    private final ReconciliationService recon;
    private final AuditService audit;

    public ReconciliationController(ReconciliationService recon, AuditService audit) {
        this.recon = recon;
        this.audit = audit;
    }

    @GetMapping("/mismatches")
    public List<Mismatch> mismatches() {
        return recon.mismatches();
    }

    @GetMapping("/summary")
    public ReconciliationService.Summary summary() {
        return recon.summary();
    }

    @PostMapping("/{txnRef}/resolve")
    public ResponseEntity<Void> resolve(@PathVariable String txnRef) {
        recon.resolve(txnRef);
        audit.append("recon.resolve", txnRef, "");
        return ResponseEntity.noContent().build();
    }
}
