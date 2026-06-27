package com.pggateway.fds.scoring.detectors;

import com.pggateway.fds.scoring.Detector;
import com.pggateway.fds.scoring.Features;
import com.pggateway.fds.scoring.RiskSignal;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * The VELOCITY layer. A real account rarely fires many transactions in seconds; bots, card-testing
 * and cash-out scripts do. Looks across short windows (1m / 10m) so a burst is caught regardless
 * of exactly how fast it runs. Complements the regulatory {@code unusual_velocity} rule (10s window)
 * with a graduated, window-aware view.
 */
@Component
public class VelocityBurstDetector implements Detector {

    @Override
    public List<RiskSignal> evaluate(CanonicalEvent event, Map<String, Object> f) {
        int v1m = Features.integer(f, "velocity1m");
        int v10m = Features.integer(f, "velocity10m");

        if (v1m >= 5) {
            return List.of(RiskSignal.of("velocity_burst_1m", "velocity",
                    "Lonjakan frekuensi (burst)", 72,
                    v1m + " transaksi dalam 1 menit dari akun ini"));
        }
        if (v10m >= 12) {
            return List.of(RiskSignal.of("velocity_burst_10m", "velocity",
                    "Frekuensi tinggi tidak wajar", 55,
                    v10m + " transaksi dalam 10 menit dari akun ini"));
        }
        return List.of();
    }
}
