package com.pggateway.fds;

import com.pggateway.fds.scoring.RiskAssessment;
import com.pggateway.fds.scoring.RiskScoringEngine;
import com.pggateway.fds.scoring.RiskSignal;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Scores incoming events with the multi-layer {@link RiskScoringEngine} and raises {@link Alert}
 * cases for anything that reaches at least MEDIUM risk.
 *
 * Decoupled from ingest: {@link #submit} hands work to a single worker thread, so a slow FDS can
 * never back-pressure the ledger (eng-review P4). In production this becomes a Kafka consumer-group;
 * per-account feature state stays local to the partition's consumer.
 *
 * Dedup: at most one OPEN alert per (tenant, account, primary-signal) — a recurring pattern updates
 * the same case rather than spamming the analyst queue.
 */
@Service
public class FraudDetectionService {

    private final RiskScoringEngine engine;
    private final AlertStore alertStore;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "fds-worker");
        t.setDaemon(true);
        return t;
    });

    public FraudDetectionService(RiskScoringEngine engine, AlertStore alertStore) {
        this.engine = engine;
        this.alertStore = alertStore;
    }

    /** Async — used by the ingest path. Returns immediately. */
    public void submit(CanonicalEvent event) {
        worker.execute(() -> inspect(event));
    }

    /** Synchronous inspection (also used by the seeder and tests). */
    public void inspect(CanonicalEvent e) {
        RiskAssessment risk = engine.assess(e); // stateful feature extraction happens once inside
        if (!risk.alertable()) return;          // below MEDIUM — logged, not surfaced as a case

        RiskSignal primary = risk.primary();
        if (alertStore.hasOpen(e.tenantId(), e.partitionKey(), primary.code())) return;

        List<String> reasons = risk.signals().stream()
                .map(s -> s.label() + " — " + s.detail() + " (+" + s.points() + ")")
                .toList();
        alertStore.create(new Alert(
                UUID.randomUUID().toString(), e.tenantId(),
                e.eventId(), e.txnRef(), e.partitionKey(), e.channel(), e.amountMinor(),
                risk.score(), risk.band().name(), primary.code(), primary.label(),
                risk.regulatoryTag(), reasons,
                AlertStatus.OPEN, Instant.now()));
    }
}
