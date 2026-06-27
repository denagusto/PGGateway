package com.pggateway.fds.scoring;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RiskScoringEngineTest {

    private RiskSignal sig(int points) {
        return RiskSignal.of("c" + points, "test", "s", points, "d");
    }

    @Test
    void no_signals_scores_zero() {
        assertEquals(0, RiskScoringEngine.combine(List.of()));
    }

    @Test
    void noisy_or_escalates_independent_signals() {
        // two medium signals compound to clearly higher than either alone, but stay < 100
        int combined = RiskScoringEngine.combine(List.of(sig(50), sig(50)));
        assertEquals(75, combined);                  // 1 - (1-.5)(1-.5) = .75
        assertTrue(combined > 50 && combined < 100);
    }

    @Test
    void single_strong_signal_dominates_and_never_hits_100() {
        assertEquals(90, RiskScoringEngine.combine(List.of(sig(90))));
        assertTrue(RiskScoringEngine.combine(List.of(sig(99), sig(99), sig(99))) < 100);
    }

    @Test
    void bands_follow_thresholds() {
        assertEquals(RiskBand.LOW, RiskBand.from(39));
        assertEquals(RiskBand.MEDIUM, RiskBand.from(40));
        assertEquals(RiskBand.HIGH, RiskBand.from(60));
        assertEquals(RiskBand.CRITICAL, RiskBand.from(80));
    }
}
