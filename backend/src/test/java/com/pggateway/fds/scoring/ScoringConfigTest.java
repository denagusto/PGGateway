package com.pggateway.fds.scoring;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The detector stack must be tunable at runtime, not compiled-in. Verifies the maintainable knobs:
 * defaults reproduce the original behaviour, layers can be switched off / re-weighted, and band
 * cut-offs move with validation.
 */
class ScoringConfigTest {

    @Test
    void defaults_reproduce_original_behaviour() {
        ScoringConfig c = new ScoringConfig();
        for (String layer : ScoringConfig.CATEGORIES) {
            assertTrue(c.enabled(layer));
            assertEquals(1.0, c.weight(layer));
        }
        assertEquals(RiskBand.LOW, c.band(39));
        assertEquals(RiskBand.MEDIUM, c.band(40));
        assertEquals(RiskBand.HIGH, c.band(60));
        assertEquals(RiskBand.CRITICAL, c.band(80));
    }

    @Test
    void layers_can_be_disabled_and_reweighted() {
        ScoringConfig c = new ScoringConfig();
        c.updateLayer("pattern", false, 1.0);
        assertFalse(c.enabled("pattern"));
        c.updateLayer("behavioral", true, 0.5);
        assertEquals(0.5, c.weight("behavioral"));
        // weight is clamped to a sane 0..2× range
        c.updateLayer("velocity", true, 9.0);
        assertEquals(2.0, c.weight("velocity"));
    }

    @Test
    void band_cutoffs_are_configurable_and_validated() {
        ScoringConfig c = new ScoringConfig();
        c.updateBands(30, 50, 70);
        assertEquals(RiskBand.MEDIUM, c.band(30));
        assertEquals(RiskBand.HIGH, c.band(50));
        assertEquals(RiskBand.CRITICAL, c.band(70));
        // invalid orderings are rejected (no silently broken triage)
        assertThrows(IllegalArgumentException.class, () -> c.updateBands(60, 50, 80));
        assertThrows(IllegalArgumentException.class, () -> c.updateLayer("nope", true, 1.0));
    }
}
