package com.pggateway.fds.scoring;

/**
 * One piece of evidence that a transaction may be fraudulent/illicit, emitted by a {@link Detector}.
 *
 * {@code points} is a 0–100 pseudo-probability — "how strongly does THIS signal alone suggest
 * fraud". The {@link RiskScoringEngine} combines independent signals so the composite never
 * exceeds 100. Signals are explainable by design: {@code detail} carries the actual numbers, which
 * is what a compliance officer (and a regulator) needs to justify a decision.
 *
 * @param code          stable machine id, e.g. "amount_anomaly"
 * @param category      behavioral | velocity | network | pattern | regulatory | watchlist
 * @param label         human label (Indonesian) for the UI
 * @param points        0–100 contribution of this signal alone
 * @param detail        explanation with concrete figures
 * @param regulatoryTag PPATK mapping when applicable ("LTKM" / "LTKT"), else ""
 */
public record RiskSignal(
        String code,
        String category,
        String label,
        int points,
        String detail,
        String regulatoryTag
) {
    public static RiskSignal of(String code, String category, String label, int points, String detail) {
        return new RiskSignal(code, category, label, points, detail, "");
    }

    public static RiskSignal regulatory(String code, String label, int points, String detail, String tag) {
        return new RiskSignal(code, "regulatory", label, points, detail, tag);
    }
}
