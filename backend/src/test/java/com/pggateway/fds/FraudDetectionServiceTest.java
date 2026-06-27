package com.pggateway.fds;

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
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FraudDetectionServiceTest {

    // Deterministic, daytime-WIB base; events are spaced 1h apart so each sits in its own velocity
    // window unless a test intends otherwise — keeps the windowed features reproducible.
    private static final Instant BASE = Instant.parse("2025-01-06T03:00:00Z"); // WIB 10:00, weekday

    private CanonicalEvent ev(String account, long amountMinor, int i) {
        return new CanonicalEvent("e" + i, "PJP-T", "idem-" + account + "-" + i, "REF-" + i, Channel.TRANSFER,
                amountMinor, "IDR", BASE.plusSeconds(i * 3600L), account, "merchant", "00", account, null, "ref");
    }

    private FraudDetectionService service(AlertStore alerts) {
        List<Detector> detectors = List.of(
                new RegulatoryRuleDetector(new RuleEngine(new RuleStore())),
                new BehavioralAnomalyDetector(),
                new VelocityBurstDetector(),
                new CounterpartyDetector(),
                new PatternDetector(),
                new WatchlistDetector(new WatchlistStore()));
        return new FraudDetectionService(new RiskScoringEngine(new FeatureExtractor(), detectors), alerts);
    }

    @Test
    void large_amount_is_critical_and_maps_to_ltkt() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        service(store).inspect(ev("ACC-1", 60_000_000_000L, 0)); // Rp 600jt
        Alert a = store.list(AlertStatus.OPEN, 10).get(0);
        assertTrue(a.score() >= 80, "single Rp 600jt transfer must be CRITICAL-scored");
        assertEquals("CRITICAL", a.band());
        assertEquals("LTKT", a.report());
        assertNotNull(a.ruleName());
        assertFalse(a.reasons().isEmpty(), "alert must explain its signals");
    }

    @Test
    void repeated_structuring_flags_account_and_dedupes_per_signal() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        FraudDetectionService fds = service(store);
        for (int i = 0; i < 4; i++) fds.inspect(ev("ACC-7", 30_000_000_000L, i)); // 4x Rp 300jt
        List<Alert> alerts = store.list(AlertStatus.OPEN, 50);
        assertFalse(alerts.isEmpty(), "repeated large sub-threshold transfers must raise a case");
        assertTrue(alerts.stream().allMatch(x -> x.account().equals("ACC-7")));
        // dedup: no signal code appears twice for the same account
        long distinctRules = alerts.stream().map(Alert::rule).distinct().count();
        assertEquals(distinctRules, alerts.size(), "each signal must be deduped to one open case");
        assertTrue(alerts.stream().anyMatch(x -> x.score() >= 80), "must reach high risk");
    }

    @Test
    void behavioral_anomaly_raises_alert_below_regulatory_thresholds() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        FraudDetectionService fds = service(store);
        // build a consistent ~Rp 1jt baseline (no alerts — small + consistent)
        long[] baseline = {90_000_000L, 110_000_000L, 95_000_000L, 105_000_000L, 100_000_000L, 98_000_000L};
        for (int i = 0; i < baseline.length; i++) fds.inspect(ev("ACC-5", baseline[i], i));
        assertTrue(store.list(AlertStatus.OPEN, 10).isEmpty(), "steady small spend must not alert");
        // a Rp 53,5jt spend — far above the account's baseline, but under every regulatory threshold
        fds.inspect(ev("ACC-5", 5_350_000_000L, 99));
        assertTrue(store.list(AlertStatus.OPEN, 10).stream().anyMatch(a -> a.rule().equals("amount_anomaly")),
                "an out-of-character amount must be caught by the behavioral layer");
    }

    @Test
    void normal_small_traffic_raises_nothing() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        FraudDetectionService fds = service(store);
        for (int i = 0; i < 3; i++) fds.inspect(ev("ACC-9", 50_000L, i)); // Rp 500
        assertTrue(store.list(AlertStatus.OPEN, 10).isEmpty());
    }

    @Test
    void verdict_moves_alert_out_of_open() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        service(store).inspect(ev("ACC-1", 60_000_000_000L, 0));
        Alert a = store.list(AlertStatus.OPEN, 10).get(0);
        store.setVerdict(a.alertId(), AlertStatus.CONFIRMED_FRAUD);
        assertEquals(AlertStatus.CONFIRMED_FRAUD, store.get(a.alertId()).orElseThrow().status());
    }
}
