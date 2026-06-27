package com.pggateway.ingest;

import java.time.Instant;

/**
 * The single internal shape every ingest adapter normalizes to. Everything downstream
 * (event store, ledger projection, FDS, reconciliation) speaks ONLY this — adapters are the
 * only place that knows about SNAP/CDC/Kafka/inline payload shapes.
 *
 * Money is stored as an integer in minor units ({@code amountMinor}, scale 2) to keep the
 * ledger exact — never floating point.
 *
 * {@code idempotencyKey} drives dedup; {@code partitionKey} (account/merchant) drives
 * shard-per-account ordering; {@code upstreamSeq} (optional) drives gap-detection.
 * {@code rawPayloadRef} points at the stored raw payload — it must NOT contain PAN.
 */
public record CanonicalEvent(
        String eventId,
        String idempotencyKey,
        String txnRef,
        Channel channel,
        long amountMinor,
        String currency,
        Instant occurredAt,
        String sourceParty,
        String destParty,
        String status,
        String partitionKey,
        Long upstreamSeq,
        String rawPayloadRef
) {
    public CanonicalEvent {
        if (idempotencyKey == null || idempotencyKey.isBlank())
            throw new IllegalArgumentException("idempotencyKey is required");
        if (partitionKey == null || partitionKey.isBlank())
            throw new IllegalArgumentException("partitionKey is required");
    }
}
