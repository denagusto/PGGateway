package com.pggateway.fds.scoring;

import java.util.List;

/**
 * The outcome of scoring one transaction: a composite 0–100 score, its band, and every signal
 * that contributed (sorted strongest-first). An assessment is "alertable" once it reaches at
 * least MEDIUM — below that it is logged but not surfaced as a case, to keep analyst noise down.
 */
public record RiskAssessment(int score, RiskBand band, List<RiskSignal> signals) {

    public boolean alertable() {
        return !signals.isEmpty() && band != RiskBand.LOW;
    }

    /** The strongest contributing signal (drives the alert's headline + dedup key). */
    public RiskSignal primary() {
        return signals.isEmpty() ? null : signals.get(0);
    }

    /** First regulatory mapping among the signals (LTKM/LTKT), or "" if none. */
    public String regulatoryTag() {
        return signals.stream()
                .map(RiskSignal::regulatoryTag)
                .filter(t -> t != null && !t.isBlank())
                .findFirst().orElse("");
    }
}
