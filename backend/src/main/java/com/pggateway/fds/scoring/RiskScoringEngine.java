package com.pggateway.fds.scoring;

import com.pggateway.fds.engine.FeatureExtractor;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * The heart of the bank-grade FDS. Extracts the enriched feature vector once, runs every
 * {@link Detector} layer, and fuses their signals into a single composite 0–100 risk score.
 *
 * Fusion uses a probabilistic OR (noisy-OR): treating each signal's {@code points/100} as an
 * independent probability of fraud, the combined probability is {@code 1 - Π(1 - p_i)}. This is
 * the standard way to combine independent evidence — two medium signals escalate to high, many
 * signals saturate toward (but never exceed) 100, and a single strong signal still dominates.
 * It avoids the naive "add the points" approach, which both double-counts and overflows.
 *
 * Detectors are injected by Spring, so the layer set is open for extension without touching this
 * class.
 */
@Service
public class RiskScoringEngine {

    private final FeatureExtractor features;
    private final List<Detector> detectors;
    private final ScoringConfig config;

    @org.springframework.beans.factory.annotation.Autowired
    public RiskScoringEngine(FeatureExtractor features, List<Detector> detectors, ScoringConfig config) {
        this.features = features;
        this.detectors = detectors;
        this.config = config;
    }

    /** Convenience for tests/contexts without Spring — uses default (all-on, ×1.0, 40/60/80) config. */
    public RiskScoringEngine(FeatureExtractor features, List<Detector> detectors) {
        this(features, detectors, ScoringConfig.defaults());
    }

    public RiskAssessment assess(CanonicalEvent event) {
        Map<String, Object> f = features.extract(event); // stateful — exactly once per event
        List<RiskSignal> signals = new ArrayList<>();
        for (Detector d : detectors) {
            try {
                signals.addAll(d.evaluate(event, f));
            } catch (Exception ignored) {
                // a misbehaving detector must never break scoring for the rest
            }
        }
        // Apply the maintainable config: drop disabled layers and scale each signal's weight.
        List<RiskSignal> tuned = new ArrayList<>();
        for (RiskSignal s : signals) {
            if (!config.enabled(s.category())) continue;
            double factor = config.weight(s.category());
            int pts = factor == 1.0 ? s.points()
                    : Math.max(0, Math.min(99, (int) Math.round(s.points() * factor)));
            tuned.add(factor == 1.0 ? s
                    : new RiskSignal(s.code(), s.category(), s.label(), pts, s.detail(), s.regulatoryTag()));
        }
        tuned.sort(Comparator.comparingInt(RiskSignal::points).reversed());
        int score = combine(tuned);
        return new RiskAssessment(score, config.band(score), List.copyOf(tuned));
    }

    /**
     * Noisy-OR fusion of independent signal probabilities into a 0–99 score. Capped at 99 on
     * purpose: the engine never claims absolute certainty — a human always owns the final call.
     */
    static int combine(List<RiskSignal> signals) {
        double survive = 1.0; // probability that NO signal indicates fraud
        for (RiskSignal s : signals) {
            int p = Math.max(0, Math.min(99, s.points())); // clamp; never a hard 100 from one signal
            survive *= (1.0 - p / 100.0);
        }
        return Math.min(99, (int) Math.round((1.0 - survive) * 100));
    }
}
