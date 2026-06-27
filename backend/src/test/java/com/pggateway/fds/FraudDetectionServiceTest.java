package com.pggateway.fds;

import com.pggateway.fds.engine.FeatureExtractor;
import com.pggateway.fds.engine.RuleEngine;
import com.pggateway.fds.rules.RuleStore;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FraudDetectionServiceTest {

    private CanonicalEvent ev(String account, long amountMinor, int i) {
        return new CanonicalEvent("e" + i, "PJP-T", "idem-" + account + "-" + i, "REF-" + i, Channel.TRANSFER,
                amountMinor, "IDR", Instant.now(), account, "merchant", "00", account, null, "ref");
    }

    private FraudDetectionService service(AlertStore alerts) {
        return new FraudDetectionService(new FeatureExtractor(), new RuleEngine(new RuleStore()), alerts);
    }

    @Test
    void large_amount_raises_ltkt() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        service(store).inspect(ev("ACC-1", 60_000_000_000L, 0)); // Rp 600jt
        List<String> rules = store.list(AlertStatus.OPEN, 10).stream().map(Alert::rule).toList();
        assertTrue(rules.contains("ltkt_threshold"));
        Alert a = store.list(AlertStatus.OPEN, 10).get(0);
        assertEquals("LTKT", a.report());
        assertNotNull(a.ruleName());
    }

    @Test
    void structuring_raises_one_alert_and_dedupes() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        FraudDetectionService fds = service(store);
        for (int i = 0; i < 4; i++) fds.inspect(ev("ACC-7", 30_000_000_000L, i)); // 4x Rp 300jt
        long structuring = store.list(AlertStatus.OPEN, 10).stream()
                .filter(a -> a.rule().equals("structuring")).count();
        assertEquals(1, structuring, "structuring must be deduped to one open alert");
    }

    @Test
    void normal_traffic_raises_nothing() {
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
