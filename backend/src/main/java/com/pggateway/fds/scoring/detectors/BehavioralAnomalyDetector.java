package com.pggateway.fds.scoring.detectors;

import com.pggateway.fds.scoring.Detector;
import com.pggateway.fds.scoring.Features;
import com.pggateway.fds.scoring.RiskSignal;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * The BEHAVIORAL layer. Compares this transaction's amount to the account's own learned baseline
 * (mean ± σ from the Feature Store). A spend several σ above what an account normally does is the
 * classic account-takeover / first-fraud signal — something static thresholds can't catch because
 * "large" is relative to each customer. Needs a baseline (≥5 prior txns) before it fires.
 */
@Component
public class BehavioralAnomalyDetector implements Detector {

    @Override
    public List<RiskSignal> evaluate(CanonicalEvent event, Map<String, Object> f) {
        double z = Features.dbl(f, "amountZScore");
        if (z < 3.0) return List.of();

        // 3σ -> ~60 points, scaling up and saturating near-certain by ~8σ.
        int points = (int) Math.min(95, 55 + (z - 3.0) * 9);
        long mean = Features.lng(f, "amountMeanMinor") / 100;
        long amt = Features.lng(f, "amountRupiah");
        String detail = "Nominal " + Features.rupiah(amt) + " menyimpang " + round1(z)
                + "σ dari rata-rata akun (" + Features.rupiah(mean) + ")";
        return List.of(RiskSignal.of("amount_anomaly", "behavioral",
                "Anomali nominal vs kebiasaan akun", points, detail));
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
