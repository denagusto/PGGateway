package com.pggateway.fds.rules;

/**
 * A customizable fraud/AML rule. Fully data-driven: the {@code expression} is a formula (SpEL)
 * over transaction features (see FeatureExtractor), so rules can be added, removed, and edited
 * at runtime from the FDS Rules screen — no redeploy.
 *
 * Example expressions:
 *   #amountMinor >= 50000000000         (Rp 500.000.000 — LTKT threshold)
 *   #subThreshold24h >= 3               (structuring — several large sub-threshold txns)
 *   #velocity10s >= 5                   (unusual velocity)
 *
 * @param report PPATK report this maps to: "LTKM" or "LTKT" (or "" if none)
 * @param score  risk score 0-100 raised when the expression is true
 */
public record Rule(
        String id,
        String name,
        String report,
        boolean enabled,
        int score,
        String expression
) {}
