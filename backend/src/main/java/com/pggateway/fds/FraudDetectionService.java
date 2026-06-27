package com.pggateway.fds;

import com.pggateway.fds.engine.FeatureExtractor;
import com.pggateway.fds.engine.RuleEngine;
import com.pggateway.fds.rules.Rule;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Runs the dynamic rule engine against incoming events and raises {@link Alert}s.
 *
 * Decoupled from ingest: {@link #submit} hands work to a single worker thread, so a slow FDS
 * can never back-pressure the ledger (eng-review P4). In production this becomes a Kafka
 * consumer-group; per-account feature state stays local to the partition's consumer.
 *
 * Dedup: at most one OPEN alert per (account, rule).
 */
@Service
public class FraudDetectionService {

    private final FeatureExtractor features;
    private final RuleEngine engine;
    private final AlertStore alertStore;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "fds-worker");
        t.setDaemon(true);
        return t;
    });

    public FraudDetectionService(FeatureExtractor features, RuleEngine engine, AlertStore alertStore) {
        this.features = features;
        this.engine = engine;
        this.alertStore = alertStore;
    }

    /** Async — used by the ingest path. Returns immediately. */
    public void submit(CanonicalEvent event) {
        worker.execute(() -> inspect(event));
    }

    /** Synchronous inspection (also used by the seeder and tests). */
    public void inspect(CanonicalEvent e) {
        Map<String, Object> f = features.extract(e); // stateful — once per event
        for (Rule r : engine.evaluate(f)) {
            if (!alertStore.hasOpen(e.tenantId(), e.partitionKey(), r.id())) {
                alertStore.create(new Alert(
                        UUID.randomUUID().toString(), e.tenantId(),
                        e.eventId(), e.txnRef(), e.partitionKey(), e.channel(), e.amountMinor(),
                        r.score(), r.id(), r.name(), r.report(),
                        List.of(r.name(), "Memenuhi formula: " + r.expression()),
                        AlertStatus.OPEN, Instant.now()));
            }
        }
    }
}
