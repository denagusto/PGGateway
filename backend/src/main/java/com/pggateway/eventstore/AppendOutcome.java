package com.pggateway.eventstore;

/** Result of trying to append an event. */
public enum AppendOutcome {
    /** Newly appended. */
    APPENDED,
    /** Idempotency key already seen — not stored again. */
    DUPLICATE
}
