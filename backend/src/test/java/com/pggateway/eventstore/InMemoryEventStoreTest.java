package com.pggateway.eventstore;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryEventStoreTest {

    private CanonicalEvent ev(String idem, String partition, Long upstreamSeq) {
        return new CanonicalEvent(
                "evt-" + idem, idem, "REF-" + idem, Channel.QRIS, 1000L, "IDR",
                Instant.now(), partition, "dest", "00", partition, upstreamSeq, "mirror:" + idem);
    }

    @Test
    void appends_and_assigns_monotonic_partition_seq() {
        InMemoryEventStore store = new InMemoryEventStore();
        AppendResult r1 = store.append(ev("A1", "ACC-1", null));
        AppendResult r2 = store.append(ev("A2", "ACC-1", null));
        assertEquals(AppendOutcome.APPENDED, r1.outcome());
        assertEquals(1L, r1.partitionSeq());
        assertEquals(2L, r2.partitionSeq());
        assertEquals(2, store.size());
    }

    @Test
    void deduplicates_on_idempotency_key() {
        InMemoryEventStore store = new InMemoryEventStore();
        store.append(ev("A1", "ACC-1", null));
        AppendResult dup = store.append(ev("A1", "ACC-1", null)); // same idem key
        assertEquals(AppendOutcome.DUPLICATE, dup.outcome());
        assertEquals(1, store.size(), "duplicate must not be stored twice");
    }

    @Test
    void partitions_have_independent_sequences() {
        InMemoryEventStore store = new InMemoryEventStore();
        AppendResult a = store.append(ev("A1", "ACC-1", null));
        AppendResult b = store.append(ev("B1", "ACC-2", null));
        assertEquals(1L, a.partitionSeq());
        assertEquals(1L, b.partitionSeq(), "each partition starts its own sequence");
    }

    @Test
    void detects_upstream_sequence_gaps() {
        InMemoryEventStore store = new InMemoryEventStore();
        AppendResult first = store.append(ev("X1", "ACC-7", 1L));
        assertTrue(first.detectedGaps().isEmpty());
        AppendResult third = store.append(ev("X3", "ACC-7", 3L)); // 2 is missing
        assertEquals(java.util.List.of(2L), third.detectedGaps());
    }

    @Test
    void recent_returns_newest_first() {
        InMemoryEventStore store = new InMemoryEventStore();
        store.append(ev("A1", "ACC-1", null));
        store.append(ev("A2", "ACC-1", null));
        var recent = store.recent(10);
        assertEquals("A2", recent.get(0).idempotencyKey());
        assertEquals("A1", recent.get(1).idempotencyKey());
    }
}
