package com.pggateway.fds.lists;

import com.pggateway.fds.lists.FdsListEntry.EntityType;
import com.pggateway.fds.lists.FdsListEntry.ListAction;
import com.pggateway.fds.scoring.RiskSignal;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The FDS lists must actually drive scoring, not just sit in a table. Verifies block → strong
 * signal, warning → softer signal, and allow → deliberately silent.
 */
class FdsListDetectorTest {

    private CanonicalEvent txn(String source, String dest) {
        return new CanonicalEvent("evt", "PJP-DEMO", "idem-" + source + dest, "ref", Channel.TRANSFER,
                50_000_00L, "IDR", Instant.EPOCH, source, dest, "00", source, null, "raw");
    }

    @Test
    void block_warning_allow_score_as_designed() {
        FdsListStore store = new FdsListStore();
        store.add(ListAction.BLOCK, EntityType.ACCOUNT, "ACC-bad", "mule");
        store.add(ListAction.WARNING, EntityType.ACCOUNT, "ACC-watch", "monitor");
        store.add(ListAction.ALLOW, EntityType.ACCOUNT, "ACC-trusted", "payroll");
        FdsListDetector det = new FdsListDetector(store);

        List<RiskSignal> block = det.evaluate(txn("ACC-bad", "ACC-clean"), Map.of());
        assertEquals(1, block.size());
        assertEquals(95, block.get(0).points());
        assertEquals("watchlist", block.get(0).category());

        List<RiskSignal> warn = det.evaluate(txn("ACC-clean", "ACC-watch"), Map.of());
        assertEquals(1, warn.size());
        assertEquals(55, warn.get(0).points());

        // allowlisted party raises nothing — that's the whole point of an allowlist
        assertTrue(det.evaluate(txn("ACC-trusted", "ACC-clean"), Map.of()).isEmpty());
        // neither side listed → silent
        assertTrue(det.evaluate(txn("ACC-clean", "ACC-other"), Map.of()).isEmpty());
    }
}
