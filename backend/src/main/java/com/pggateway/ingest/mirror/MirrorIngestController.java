package com.pggateway.ingest.mirror;

import com.pggateway.audit.AuditService;
import com.pggateway.eventstore.AppendOutcome;
import com.pggateway.eventstore.AppendResult;
import com.pggateway.eventstore.EventStore;
import com.pggateway.fds.FraudDetectionService;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.IngestException;
import com.pggateway.ledger.LedgerProjectionService;
import com.pggateway.security.SnapSignatureFilter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/** Receives SNAP mirror callbacks: normalize -> append. Read-only sidecar, not the critical path. */
@RestController
@RequestMapping("/api/ingest")
public class MirrorIngestController {

    private final MirrorIngestAdapter adapter;
    private final EventStore store;
    private final FraudDetectionService fds;
    private final LedgerProjectionService ledger;
    private final AuditService audit;

    public MirrorIngestController(MirrorIngestAdapter adapter, EventStore store,
                                  FraudDetectionService fds, LedgerProjectionService ledger,
                                  AuditService audit) {
        this.adapter = adapter;
        this.store = store;
        this.fds = fds;
        this.ledger = ledger;
        this.audit = audit;
    }

    @PostMapping("/mirror")
    public ResponseEntity<Map<String, Object>> mirror(
            @RequestBody MirrorPayload payload,
            @RequestAttribute(name = SnapSignatureFilter.ATTR_TENANT, required = false) String tenantId) {
        CanonicalEvent event = adapter.normalize(payload); // throws IngestException on bad input
        AppendResult result = store.append(event);
        if (result.outcome() == AppendOutcome.APPENDED) {
            fds.submit(event);    // async — never blocks the ledger
            ledger.submit(event); // async projection
            audit.append("ingest.mirror", event.txnRef(),
                    (tenantId == null ? "?" : tenantId) + " · " + event.partitionKey());
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("outcome", result.outcome());
        body.put("tenantId", tenantId); // resolved from the verified SNAP signature
        body.put("eventId", event.eventId());
        body.put("partitionSeq", result.partitionSeq());
        body.put("gaps", result.detectedGaps());
        return ResponseEntity.ok(body);
    }

    @ExceptionHandler(IngestException.class)
    public ResponseEntity<Map<String, Object>> onBadPayload(IngestException e) {
        return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
    }
}
