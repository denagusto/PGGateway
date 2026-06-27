package com.pggateway.fds.detectors;

import com.pggateway.fds.FraudSignal;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class AmountAnomalyDetectorTest {

    private CanonicalEvent ev(long amountMinor) {
        return new CanonicalEvent("e", "idem", "REF", Channel.TRANSFER, amountMinor, "IDR",
                Instant.now(), "ACC-1", "dest", "00", "ACC-1", null, "ref");
    }

    @Test
    void flags_large_amount() {
        AmountAnomalyDetector d = new AmountAnomalyDetector();
        FraudSignal s = d.evaluate(ev(950_000_000L)); // Rp 9.500.000
        assertNotNull(s);
        assertEquals("amount_anomaly", s.rule());
        assertTrue(s.score() >= 70);
    }

    @Test
    void ignores_normal_amount() {
        AmountAnomalyDetector d = new AmountAnomalyDetector();
        assertNull(d.evaluate(ev(43_000_000L))); // Rp 430.000
    }
}
