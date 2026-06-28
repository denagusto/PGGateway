package com.pggateway.developer;

import com.pggateway.audit.AuditService;
import com.pggateway.auth.AuthPrincipal;
import com.pggateway.auth.TenantScope;
import com.pggateway.eventstore.AppendOutcome;
import com.pggateway.eventstore.AppendResult;
import com.pggateway.eventstore.EventStore;
import com.pggateway.fds.FraudDetectionService;
import com.pggateway.fds.scoring.RiskAssessment;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.mirror.MirrorIngestAdapter;
import com.pggateway.ingest.mirror.MirrorPayload;
import com.pggateway.ledger.LedgerProjectionService;
import com.pggateway.ledger.gl.GeneralLedgerService;
import com.pggateway.live.LiveBus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * In-app sandbox simulator. Runs a transaction through the <b>real</b> ingest pipeline (event store →
 * fraud scoring → ledger → general ledger) so developers and analysts can fire test/fraud scenarios
 * from the console and immediately see the outcome — including the risk score and which detectors
 * fired.
 *
 * <p>This is intentionally separate from {@code /api/ingest/**}: the partner-facing ingest stays
 * locked behind the SNAP HMAC signature (no browser-side secret), while this internal path is
 * authenticated by the user's JWT session and stamps the tenant from that session. So the test
 * button works without weakening production ingest security.
 *
 * <p>Scoring runs synchronously here (unlike the async prod path) so the response can carry the
 * assessment back to the simulator UI.
 */
@RestController
@RequestMapping("/api/dev/simulate")
public class DevSimulateController {

    private final MirrorIngestAdapter adapter;
    private final EventStore store;
    private final FraudDetectionService fds;
    private final LedgerProjectionService ledger;
    private final GeneralLedgerService gl;
    private final AuditService audit;
    private final LiveBus live;
    private final TenantScope tenantScope;

    public DevSimulateController(MirrorIngestAdapter adapter, EventStore store, FraudDetectionService fds,
                                 LedgerProjectionService ledger, GeneralLedgerService gl, AuditService audit,
                                 LiveBus live, TenantScope tenantScope) {
        this.adapter = adapter;
        this.store = store;
        this.fds = fds;
        this.ledger = ledger;
        this.gl = gl;
        this.audit = audit;
        this.live = live;
        this.tenantScope = tenantScope;
    }

    @PostMapping
    public SimulateResult simulate(@RequestBody MirrorPayload payload) {
        AuthPrincipal user = tenantScope.current();
        String tenant = (user != null && user.tenantId() != null && !user.tenantId().isBlank())
                ? user.tenantId() : "PJP-DEMO";

        CanonicalEvent event = adapter.normalize(payload).withTenant(tenant);
        AppendResult result = store.append(event);

        if (result.outcome() != AppendOutcome.APPENDED) {
            return new SimulateResult(result.outcome().name(), event.eventId(), tenant,
                    false, 0, "—", false, List.of());
        }

        RiskAssessment risk = fds.inspect(event); // synchronous so we can report the score
        ledger.submit(event);
        gl.submit(event);
        audit.append("dev.simulate", event.txnRef(), tenant + " · skor " + risk.score());
        live.publish("transactions");
        if (risk.alertable()) live.publish("alerts");

        List<Signal> signals = risk.signals().stream()
                .map(s -> new Signal(s.label(), s.category(), s.points()))
                .toList();
        return new SimulateResult(result.outcome().name(), event.eventId(), tenant,
                true, risk.score(), risk.band().name(), risk.alertable(), signals);
    }

    public record Signal(String label, String category, int points) {}
    public record SimulateResult(String outcome, String eventId, String tenant, boolean scored,
                                 int score, String band, boolean alertRaised, List<Signal> signals) {}
}
