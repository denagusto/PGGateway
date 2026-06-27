package com.pggateway.fds;

import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Runs every {@link FraudDetector} against incoming events and raises {@link Alert}s.
 *
 * Decoupled from ingest: {@link #submit} hands work to a single worker thread, so a slow
 * FDS can NEVER back-pressure the ledger (eng-review P4). In production this becomes a Kafka
 * consumer-group; per-account detector state stays local to the partition's consumer.
 *
 * Dedup: at most one OPEN alert per (account, rule) — no alert spam during a fraud spree.
 */
@Service
public class FraudDetectionService {

    private final List<FraudDetector> detectors;
    private final AlertStore alertStore;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "fds-worker");
        t.setDaemon(true);
        return t;
    });

    public FraudDetectionService(List<FraudDetector> detectors, AlertStore alertStore) {
        this.detectors = detectors;
        this.alertStore = alertStore;
    }

    /** Async — used by the ingest path. Returns immediately. */
    public void submit(CanonicalEvent event) {
        worker.execute(() -> inspect(event));
    }

    /** Synchronous inspection (also used by tests). Runs all detectors, raises deduped alerts. */
    public void inspect(CanonicalEvent e) {
        for (FraudDetector d : detectors) {
            FraudSignal s = d.evaluate(e);
            if (s != null && !alertStore.hasOpen(e.partitionKey(), s.rule())) {
                alertStore.create(new Alert(
                        UUID.randomUUID().toString(),
                        e.eventId(), e.txnRef(), e.partitionKey(), e.channel(), e.amountMinor(),
                        s.score(), s.rule(), s.reasons(), AlertStatus.OPEN, Instant.now()));
            }
        }
    }
}
