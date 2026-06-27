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

    /** Most recent events for one tenant (PJP), newest first. {@code tenantId} null = all tenants. */
    List<CanonicalEvent> recent(int limit, String tenantId);

    /** Total events stored for one tenant. {@code tenantId} null = all tenants. */
    int size(String tenantId);

    /** Most recent events across all tenants (for the UI / debugging). */
    default List<CanonicalEvent> recent(int limit) {
        return recent(limit, null);
    }

    /** Total events stored across all tenants. */
    default int size() {
        return size(null);
    }
}
