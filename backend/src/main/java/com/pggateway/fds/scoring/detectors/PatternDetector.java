package com.pggateway.fds.scoring.detectors;

import com.pggateway.fds.scoring.Detector;
import com.pggateway.fds.scoring.Features;
import com.pggateway.fds.scoring.RiskSignal;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The PATTERN layer. Weak-on-their-own tells that matter when they stack with other signals (the
 * noisy-OR fusion lets them tip a borderline case): large round-number amounts (illicit transfers
 * are often round; genuine retail spend rarely is) and large value moved in the dead-of-night.
 */
@Component
public class PatternDetector implements Detector {

    private static final long MATERIAL_RUPIAH = 50_000_000L; // Rp 50 juta — ignore noise below this

    @Override
    public List<RiskSignal> evaluate(CanonicalEvent event, Map<String, Object> f) {
        List<RiskSignal> signals = new ArrayList<>();
        long amt = Features.lng(f, "amountRupiah");
        if (amt < MATERIAL_RUPIAH) return signals;

        if (Features.bool(f, "roundAmount")) {
            signals.add(RiskSignal.of("round_amount", "pattern",
                    "Nominal bulat bernilai besar", 30,
                    "Nominal " + Features.rupiah(amt) + " kelipatan persis Rp 1 juta"));
        }
        if (Features.bool(f, "offHours")) {
            signals.add(RiskSignal.of("off_hours", "pattern",
                    "Transaksi besar di luar jam wajar", 38,
                    "Transaksi " + Features.rupiah(amt) + " pukul "
                            + Features.integer(f, "hourOfDayWib") + ":00 WIB"));
        }
        return signals;
    }
}
