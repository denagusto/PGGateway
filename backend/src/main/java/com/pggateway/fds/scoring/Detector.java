package com.pggateway.fds.scoring;

import com.pggateway.ingest.CanonicalEvent;

import java.util.List;
import java.util.Map;

/**
 * One fraud-detection layer. Each detector inspects the transaction plus its enriched feature
 * vector and returns zero or more {@link RiskSignal}s. Detectors are independent and composable —
 * adding a new layer is just a new {@code @Component} implementing this interface; the
 * {@link RiskScoringEngine} discovers and runs them all.
 */
public interface Detector {

    /** Signals raised by this layer for the given transaction. Empty when nothing fires. */
    List<RiskSignal> evaluate(CanonicalEvent event, Map<String, Object> features);
}
