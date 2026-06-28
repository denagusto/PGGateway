package com.pggateway.fds.ai;

import com.pggateway.audit.AuditService;
import com.pggateway.fds.Alert;
import com.pggateway.fds.AlertStore;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Optional;

/**
 * Confidential FDS copilot + typology library surface (ADMIN/ANALYST only — locked in SecurityConfig).
 *
 * <ul>
 *   <li>GET  /api/fds/typologies         — the local knowledge base (Pustaka Tipologi)
 *   <li>POST /api/fds/copilot/{alertId}  — summarise a case + draft a grounded report
 * </ul>
 *
 * All on-premise: the copilot is a complement to the ML+rules core and never decides anything.
 */
@RestController
@RequestMapping("/api/fds")
public class CopilotController {

    private final TypologyLibrary library;
    private final CaseCopilot copilot;
    private final AlertStore alerts;
    private final AuditService audit;

    public CopilotController(TypologyLibrary library, CaseCopilot copilot, AlertStore alerts, AuditService audit) {
        this.library = library;
        this.copilot = copilot;
        this.alerts = alerts;
        this.audit = audit;
    }

    @GetMapping("/typologies")
    public List<Typology> typologies() {
        return library.all();
    }

    @PostMapping("/copilot/{alertId}")
    public ResponseEntity<CaseCopilot.Result> generate(@PathVariable String alertId) {
        Optional<Alert> alert = alerts.get(alertId);
        if (alert.isEmpty()) return ResponseEntity.notFound().build();
        CaseCopilot.Result result = copilot.forAlert(alert.get());
        audit.append("fds.copilot.generate", alertId,
                result.matchedTypologies().isEmpty() ? "tanpa tipologi cocok"
                        : result.matchedTypologies().get(0).code());
        return ResponseEntity.ok(result);
    }
}
