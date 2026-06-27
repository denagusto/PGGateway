package com.pggateway.fds;

import com.pggateway.ingest.CanonicalEvent;

/**
 * A single fraud rule. Pluggable: add a {@code @Component} implementing this and the
 * {@link FraudDetectionService} picks it up automatically (ML-ready — a model-backed
 * detector implements the same interface).
 */
public interface FraudDetector {

    /** Stable rule id, e.g. "velocity_new_account". */
    String name();

    /** Return a {@link FraudSignal} if this event looks fraudulent, or {@code null} if clean. */
    FraudSignal evaluate(CanonicalEvent event);
}
