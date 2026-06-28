package com.pggateway.recon;

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
import java.util.Optional;

/**
 * Reconciliation workspace API: settlement runs, categorised breaks, the exception workflow, and a
 * summary for the KPIs. Mutations are audited.
 */
@RestController
@RequestMapping("/api/recon")
public class ReconWorkspaceController {

    private final ReconWorkspace workspace;
    private final AuditService audit;

    public ReconWorkspaceController(ReconWorkspace workspace, AuditService audit) {
        this.workspace = workspace;
        this.audit = audit;
    }

    @GetMapping("/runs")
    public List<ReconRun> runs() {
        return workspace.runs();
    }

    @GetMapping("/breaks")
    public List<ReconBreak> breaks(@RequestParam(required = false) String status,
                                   @RequestParam(required = false) String category,
                                   @RequestParam(required = false) String source,
                                   @RequestParam(required = false) String search) {
        return workspace.breaks(status, category, source, search);
    }

    @GetMapping("/summary")
    public ReconWorkspace.Summary summary() {
        return workspace.summary();
    }

    @PostMapping("/breaks/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody UpdateRequest req) {
        try {
            Optional<ReconBreak> updated = workspace.update(id, req.status(), req.assignee(), req.note());
            if (updated.isEmpty()) return ResponseEntity.notFound().build();
            audit.append("recon.break.update", id,
                    (req.status() == null ? "" : "status=" + req.status() + " ")
                            + (req.assignee() == null ? "" : "assignee=" + req.assignee()));
            return ResponseEntity.ok(updated.get());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new Err(e.getMessage()));
        }
    }

    public record UpdateRequest(String status, String assignee, String note) {}
    public record Err(String error) {}
}
