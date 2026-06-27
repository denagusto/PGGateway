package com.pggateway.fds.detectors;

import com.pggateway.fds.FraudDetector;
import com.pggateway.fds.FraudSignal;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.List;

/** Flags a single transaction whose amount is unusually large. Stateless. */
@Component
public class AmountAnomalyDetector implements FraudDetector {

    /** Rp 5.000.000 in minor units (scale 2). */
    static final long THRESHOLD_MINOR = 500_000_000L;

    @Override
    public String name() {
        return "amount_anomaly";
    }

    @Override
    public FraudSignal evaluate(CanonicalEvent e) {
        if (e.amountMinor() >= THRESHOLD_MINOR) {
            long rupiah = e.amountMinor() / 100;
            int score = (int) Math.min(92, 70 + (e.amountMinor() - THRESHOLD_MINOR) / 100_000_000L);
            return new FraudSignal(score, name(),
                    List.of("nominal Rp " + rupiah + " di atas ambang kewajaran",
                            "jauh di atas rata-rata akun"));
        }
        return null;
    }
}
