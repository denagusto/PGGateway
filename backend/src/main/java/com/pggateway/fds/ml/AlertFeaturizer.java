package com.pggateway.fds.ml;

import com.pggateway.fds.Alert;
import com.pggateway.fds.AlertStatus;

import java.util.Locale;

/**
 * Turns an {@link Alert} into the fixed, named feature vector the {@link LogisticModel} consumes —
 * the single source of truth for the model's input schema, used identically for training (from
 * resolved cases) and inference (triaging a live alert).
 *
 * <p>Every feature is human-meaningful so the learned weights are directly explainable. Features are
 * derived only from what the alert already persists (score, band, PPATK mapping, and the signal
 * evidence), so no extra feature store plumbing is needed and the model trains purely on the durable
 * case record + the analyst's verdict.
 */
public final class AlertFeaturizer {

    /** Stable, ordered feature names. Order MUST match {@link #toRow(Alert)}. */
    public static final String[] FEATURES = {
            "skor_komposit",      // 0 normalised engine score
            "nominal_log",        // 1 log-scaled rupiah amount
            "band_risiko",        // 2 LOW..CRITICAL ordinal
            "tag_ltkm",           // 3 maps to PPATK LTKM
            "tag_ltkt",           // 4 maps to PPATK LTKT
            "kepadatan_bukti",    // 5 how many signals fired
            "sinyal_watchlist",   // 6 sanctions / DTTOT / mule list hit
            "sinyal_velocity",    // 7 transaction-rate burst
            "sinyal_anomali",     // 8 amount/behaviour deviation from baseline
            "sinyal_jaringan",    // 9 counterparty / fan-out / mule ring
            "sinyal_structuring", //10 smurfing / sub-threshold accumulation
            "sinyal_offhours",    //11 transacted outside normal hours
    };

    private AlertFeaturizer() {}

    /** Feature row for an alert, in {@link #FEATURES} order. Values are roughly normalised to 0..1. */
    public static double[] toRow(Alert a) {
        String band = a.band() == null ? "" : a.band().toUpperCase(Locale.ROOT);
        double bandOrd = switch (band) {
            case "CRITICAL" -> 1.0;
            case "HIGH" -> 0.66;
            case "MEDIUM" -> 0.33;
            default -> 0.0;
        };
        double rupiah = a.amountMinor() / 100.0;
        double amountLog = Math.min(1.0, Math.log10(1 + Math.max(0, rupiah)) / 9.0); // ~Rp1M..Rp1B → 0.6..0.9
        String report = a.report() == null ? "" : a.report().toUpperCase(Locale.ROOT);
        int sigCount = a.reasons() == null ? 0 : a.reasons().size();

        String hay = ((a.rule() == null ? "" : a.rule()) + " " + (a.ruleName() == null ? "" : a.ruleName())
                + " " + String.join(" ", a.reasons() == null ? java.util.List.of() : a.reasons()))
                .toLowerCase(Locale.ROOT);

        return new double[] {
                a.score() / 100.0,
                amountLog,
                bandOrd,
                report.contains("LTKM") ? 1 : 0,
                report.contains("LTKT") ? 1 : 0,
                Math.min(1.0, sigCount / 6.0),
                has(hay, "watchlist", "pantau", "sanksi", "dttot") ? 1 : 0,
                has(hay, "velocity", "frekuensi", "burst", "kecepatan") ? 1 : 0,
                has(hay, "anomali", "z-score", "zscore", "lonjakan", "baseline", "tak biasa") ? 1 : 0,
                has(hay, "counterparty", "lawan transaksi", "fan-out", "fanout", "jaringan", "penerima", "mule") ? 1 : 0,
                has(hay, "structuring", "pecah", "sub-threshold", "subthreshold", "akumulasi", "ltkt") ? 1 : 0,
                has(hay, "off-hours", "offhours", "luar jam", "dini hari", "jam wajar") ? 1 : 0,
        };
    }

    /** 1 if the alert is a usable label (analyst gave a verdict), else this alert is unlabelled. */
    public static boolean isLabelled(Alert a) {
        return a.status() == AlertStatus.CONFIRMED_FRAUD || a.status() == AlertStatus.FALSE_POSITIVE;
    }

    public static int label(Alert a) {
        return a.status() == AlertStatus.CONFIRMED_FRAUD ? 1 : 0;
    }

    private static boolean has(String hay, String... needles) {
        for (String n : needles) if (hay.contains(n)) return true;
        return false;
    }
}
