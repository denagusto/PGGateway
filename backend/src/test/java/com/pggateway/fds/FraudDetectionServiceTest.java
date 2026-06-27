package com.pggateway.fds;

import com.pggateway.fds.detectors.AmountAnomalyDetector;
import com.pggateway.fds.detectors.VelocityDetector;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class FraudDetectionServiceTest {

    private CanonicalEvent ev(String account, long amountMinor, int i) {
        return new CanonicalEvent("e" + i, "idem-" + account + "-" + i, "REF-" + i, Channel.QRIS,
                amountMinor, "IDR", Instant.now(), account, "merchant", "00", account, null, "ref");
    }

    private FraudDetectionService newService(AlertStore store) {
        return new FraudDetectionService(
                List.of(new VelocityDetector(), new AmountAnomalyDetector()), store);
    }

    @Test
    void raises_amount_anomaly_alert() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        newService(store).inspect(ev("ACC-1", 950_000_000L, 0));
        List<Alert> open = store.list(AlertStatus.OPEN, 10);
        assertEquals(1, open.size());
        assertEquals("amount_anomaly", open.get(0).rule());
    }

    @Test
    void raises_one_velocity_alert_and_dedupes() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        FraudDetectionService fds = newService(store);
        for (int i = 0; i < 7; i++) {
            fds.inspect(ev("ACC-7", 20_000L, i)); // burst, normal amounts
        }
        List<Alert> velocity = store.list(AlertStatus.OPEN, 10).stream()
                .filter(a -> a.rule().equals("velocity_new_account")).toList();
        assertEquals(1, velocity.size(), "burst must raise exactly one velocity alert (deduped)");
        assertEquals("ACC-7", velocity.get(0).account());
    }

    @Test
    void normal_traffic_raises_nothing() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        FraudDetectionService fds = newService(store);
        for (int i = 0; i < 3; i++) fds.inspect(ev("ACC-9", 50_000L, i)); // below velocity + amount
        assertTrue(store.list(AlertStatus.OPEN, 10).isEmpty());
    }

    @Test
    void verdict_moves_alert_out_of_open() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        newService(store).inspect(ev("ACC-1", 950_000_000L, 0));
        Alert a = store.list(AlertStatus.OPEN, 10).get(0);
        store.setVerdict(a.alertId(), AlertStatus.CONFIRMED_FRAUD);
        assertTrue(store.list(AlertStatus.OPEN, 10).isEmpty());
        assertEquals(AlertStatus.CONFIRMED_FRAUD, store.get(a.alertId()).orElseThrow().status());
    }
}
