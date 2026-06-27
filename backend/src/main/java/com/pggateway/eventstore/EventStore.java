package com.pggateway.eventstore;

import com.pggateway.ingest.CanonicalEvent;

import java.util.List;

/**
 * Append-only event store. T1 ships an in-memory implementation; later tasks back this with
 * a durable, partitioned store (Kafka log + CockroachDB projections).
 *
 * Contract:
 *  - append() is idempotent on {@code idempotencyKey} (at-least-once ingest is safe to retry)
 *  - per-partition ordering + monotonic sequence
 *  - gap-detection against optional upstream sequence numbers
 */
public interface EventStore {

    AppendResult append(CanonicalEvent event);

    /** Most recent events, newest first (for the UI / debugging). */
    List<CanonicalEvent> recent(int limit);
}
