package com.pggateway.fds.scoring;

/**
 * Risk tier derived from the composite 0–100 score — drives alert prioritization and SLA, the
 * way a bank's case queue is triaged. Thresholds are deliberately simple constants here; in a
 * tuned deployment they move with the model's measured precision per band.
 */
public enum RiskBand {
    LOW, MEDIUM, HIGH, CRITICAL;

    public static RiskBand from(int score) {
        if (score >= 80) return CRITICAL;
        if (score >= 60) return HIGH;
        if (score >= 40) return MEDIUM;
        return LOW;
    }
}
