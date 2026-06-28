package com.pggateway.fds.scoring;

import com.pggateway.audit.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Confidential surface for tuning the detector stack (ADMIN/ANALYST only — locked in SecurityConfig).
 * GET returns the live config; PUT applies a full update (every layer's on/off + weight, plus the
 * band cut-offs) atomically and writes an audit entry — change-tracking for the "secret sauce".
 */
@RestController
@RequestMapping("/api/fds/scoring-config")
public class ScoringConfigController {

    private final ScoringConfig config;
    private final AuditService audit;

    public ScoringConfigController(ScoringConfig config, AuditService audit) {
        this.config = config;
        this.audit = audit;
    }

    @GetMapping
    public ScoringConfig.Snapshot get() {
        return config.snapshot();
    }

    @PutMapping
    public ResponseEntity<?> update(@RequestBody UpdateRequest req) {
        try {
            if (req.layers() != null) {
                for (LayerUpdate l : req.layers()) config.updateLayer(l.category(), l.enabled(), l.weight());
            }
            config.updateBands(req.mediumCutoff(), req.highCutoff(), req.criticalCutoff());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new Err(e.getMessage()));
        }
        audit.append("fds.scoring.config", "scoring-config",
                "bands=" + req.mediumCutoff() + "/" + req.highCutoff() + "/" + req.criticalCutoff()
                        + " layers=" + (req.layers() == null ? 0 : req.layers().size()));
        return ResponseEntity.ok(config.snapshot());
    }

    public record LayerUpdate(String category, boolean enabled, double weight) {}
    public record UpdateRequest(List<LayerUpdate> layers, int mediumCutoff, int highCutoff, int criticalCutoff) {}
    public record Err(String error) {}
}
