package com.pggateway.loadtest;

import com.pggateway.eventstore.InMemoryEventStore;
import com.pggateway.fds.FraudDetectionService;
import com.pggateway.fds.InMemoryAlertStore;
import com.pggateway.fds.engine.FeatureExtractor;
import com.pggateway.fds.engine.RuleEngine;
import com.pggateway.fds.rules.RuleStore;
import com.pggateway.fds.scoring.Detector;
import com.pggateway.fds.scoring.RiskScoringEngine;
import com.pggateway.fds.scoring.WatchlistStore;
import com.pggateway.fds.scoring.detectors.BehavioralAnomalyDetector;
import com.pggateway.fds.scoring.detectors.CounterpartyDetector;
import com.pggateway.fds.scoring.detectors.PatternDetector;
import com.pggateway.fds.scoring.detectors.RegulatoryRuleDetector;
import com.pggateway.fds.scoring.detectors.VelocityBurstDetector;
import com.pggateway.fds.scoring.detectors.WatchlistDetector;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import com.pggateway.ledger.LedgerProjectionService;
import com.pggateway.ledger.gl.ChartOfAccounts;
import com.pggateway.ledger.gl.GeneralLedgerService;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Throughput validation against the 50,000 TPS target.
 *
 * The ingest hot path (canonical-event append: per-partition lock + idempotency dedup + sequence)
 * is what must sustain peak TPS — it shards by account, so it scales with cores. The projections
 * (FDS/ledger/GL) are single-worker STAND-INS here; production runs them as partitioned Kafka
 * consumer groups (one consumer per shard), so their aggregate throughput scales the same way. This
 * test measures the per-worker projection rate and multiplies out the shard count to show headroom.
 */
class IngestThroughputTest {

    private static final Instant T = Instant.parse("2025-01-06T03:00:00Z");

    private CanonicalEvent event(int i, int partitions) {
        String acc = "ACC-" + (i % partitions);
        return new CanonicalEvent("e" + i, "PJP-DEMO", "idem-" + i, "REF-" + i, Channel.QRIS,
                100_000 + (i % 900_000), "IDR", T, acc, "ACC-merchant", "00", acc, null, "ref");
    }

    @Test
    void ingest_append_path_exceeds_50k_tps() throws InterruptedException {
        InMemoryEventStore store = new InMemoryEventStore();
        int events = 500_000, threads = Math.max(4, Runtime.getRuntime().availableProcessors());
        int partitions = 1024;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        AtomicInteger seq = new AtomicInteger();
        CountDownLatch done = new CountDownLatch(threads);

        long start = System.nanoTime();
        for (int t = 0; t < threads; t++) {
            pool.submit(() -> {
                int i;
                while ((i = seq.getAndIncrement()) < events) store.append(event(i, partitions));
                done.countDown();
            });
        }
        done.await();
        long ns = System.nanoTime() - start;
        pool.shutdown();

        double tps = events / (ns / 1e9);
        System.out.printf("%n[LOAD] ingest append: %,.0f events/sec  (%d events, %d threads, %d partitions)%n",
                tps, events, threads, partitions);
        assertEquals(events, store.size());
        assertTrue(tps > 50_000, "ingest append must exceed the 50k TPS target, was " + (long) tps);
    }

    @Test
    void full_pipeline_per_worker_then_scaled() {
        InMemoryAlertStore alerts = new InMemoryAlertStore();
        List<Detector> detectors = List.of(
                new RegulatoryRuleDetector(new RuleEngine(new RuleStore())),
                new BehavioralAnomalyDetector(), new VelocityBurstDetector(),
                new CounterpartyDetector(), new PatternDetector(),
                new WatchlistDetector(new WatchlistStore()));
        FraudDetectionService fds = new FraudDetectionService(new RiskScoringEngine(new FeatureExtractor(), detectors), alerts);
        LedgerProjectionService ledger = new LedgerProjectionService();
        GeneralLedgerService gl = new GeneralLedgerService(new ChartOfAccounts());

        int events = 100_000, partitions = 1024;
        long start = System.nanoTime();
        for (int i = 0; i < events; i++) {
            CanonicalEvent e = event(i, partitions);
            fds.inspect(e);   // scoring + feature extraction
            ledger.apply(e);  // double-entry projection
            gl.apply(e);      // general ledger posting
        }
        long ns = System.nanoTime() - start;
        double perWorker = events / (ns / 1e9);
        int shards = 32; // e.g. 32 Kafka partitions -> 32 parallel consumers in production
        System.out.printf("[LOAD] full pipeline (FDS+ledger+GL): %,.0f events/sec per worker -> ~%,.0f events/sec at %d shards%n",
                perWorker, perWorker * shards, shards);
        assertTrue(perWorker > 5_000, "per-worker pipeline throughput unexpectedly low: " + (long) perWorker);
    }
}
