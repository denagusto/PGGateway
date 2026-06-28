package com.pggateway.fds.scoring;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Runtime-tunable configuration for the scoring engine — the thing that makes the detector stack
 * <b>maintainable</b> instead of hard-coded. The risk/fraud team can, per detector layer, switch it
 * on/off and scale its weight, and can move the band cut-offs that drive triage — all without a
 * redeploy. The {@link RiskScoringEngine} reads this on every assessment.
 *
 * <p>Defaults reproduce the original compiled-in behaviour exactly (every layer on, weight ×1.0,
 * 40/60/80 bands), so an unconfigured system scores identically to before.
 *
 * <p>In-memory + thread-safe for now; the same shape persists to the durable store later. Only
 * ADMIN/ANALYST can read or change it (locked in SecurityConfig) — these knobs are detection IP.
 */
@Component
public class ScoringConfig {

    /** The six detector layers, in display order. Keys match {@link RiskSignal#category()}. */
    public static final List<String> CATEGORIES =
            List.of("regulatory", "behavioral", "velocity", "network", "pattern", "watchlist");

    public record Layer(boolean enabled, double weight) {}

    private final Map<String, Layer> layers = new ConcurrentHashMap<>();
    private volatile int mediumCutoff = 40;
    private volatile int highCutoff = 60;
    private volatile int criticalCutoff = 80;

    public ScoringConfig() {
        for (String c : CATEGORIES) layers.put(c, new Layer(true, 1.0));
    }

    public boolean enabled(String category) {
        Layer l = layers.get(category);
        return l == null || l.enabled(); // unknown categories are not suppressed
    }

    /** Weight multiplier for a layer (1.0 = unchanged). Unknown categories pass through at 1.0. */
    public double weight(String category) {
        Layer l = layers.get(category);
        return l == null ? 1.0 : l.weight();
    }

    /** Band for a score using the configurable cut-offs. */
    public RiskBand band(int score) {
        if (score >= criticalCutoff) return RiskBand.CRITICAL;
        if (score >= highCutoff) return RiskBand.HIGH;
        if (score >= mediumCutoff) return RiskBand.MEDIUM;
        return RiskBand.LOW;
    }

    // ---- mutation (validated) ----

    public synchronized void updateLayer(String category, boolean enabled, double weight) {
        if (!layers.containsKey(category)) throw new IllegalArgumentException("unknown layer: " + category);
        double w = Math.max(0.0, Math.min(2.0, weight)); // clamp 0..2×
        layers.put(category, new Layer(enabled, w));
    }

    public synchronized void updateBands(int medium, int high, int critical) {
        if (!(0 < medium && medium < high && high < critical && critical <= 99)) {
            throw new IllegalArgumentException("bands must satisfy 0 < medium < high < critical ≤ 99");
        }
        this.mediumCutoff = medium;
        this.highCutoff = high;
        this.criticalCutoff = critical;
    }

    // ---- snapshot for the API ----

    public Snapshot snapshot() {
        Map<String, Layer> out = new LinkedHashMap<>();
        for (String c : CATEGORIES) out.put(c, layers.get(c));
        return new Snapshot(out, mediumCutoff, highCutoff, criticalCutoff);
    }

    public record Snapshot(Map<String, Layer> layers, int mediumCutoff, int highCutoff, int criticalCutoff) {}

    /** A plain default instance for tests/contexts that construct the engine without Spring. */
    public static ScoringConfig defaults() {
        return new ScoringConfig();
    }
}
