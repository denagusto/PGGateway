package com.pggateway.fds.detectors;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class VelocityDetectorTest {

    private CanonicalEvent ev(String account, int i) {
        return new CanonicalEvent("e" + i, "idem-" + account + "-" + i, "REF", Channel.QRIS,
                10_000L, "IDR", Instant.now(), account, "dest", "00", account, null, "ref");
    }

    @Test
    void flags_only_after_threshold() {
        VelocityDetector d = new VelocityDetector();
        for (int i = 0; i < VelocityDetector.THRESHOLD - 1; i++) {
            assertNull(d.evaluate(ev("ACC-1", i)), "below threshold must be clean");
        }
        assertNotNull(d.evaluate(ev("ACC-1", 99)), "reaching threshold must flag");
    }

    @Test
    void accounts_are_independent() {
        VelocityDetector d = new VelocityDetector();
        for (int i = 0; i < 4; i++) d.evaluate(ev("ACC-1", i));
        // a different account with one event stays clean
        assertNull(d.evaluate(ev("ACC-2", 0)));
    }
}
