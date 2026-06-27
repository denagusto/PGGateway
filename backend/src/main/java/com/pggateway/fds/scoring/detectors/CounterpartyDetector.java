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
 * The NETWORK / GRAPH layer. Money-laundering shows up in the transaction graph, not in any single
 * payment: a freshly-used counterparty receiving a large sum, or one account fanning out to many
 * distinct beneficiaries in a day (a classic mule / layering pattern). These need the counterparty
 * history the Feature Store keeps, which a per-transaction rule can't see.
 */
@Component
public class CounterpartyDetector implements Detector {

    private static final long LARGE_RUPIAH = 100_000_000L; // Rp 100 juta

    @Override
    public List<RiskSignal> evaluate(CanonicalEvent event, Map<String, Object> f) {
        List<RiskSignal> signals = new ArrayList<>();
        long amt = Features.lng(f, "amountRupiah");
        int fanOut = Features.integer(f, "fanOut24h");

        if (Features.bool(f, "newCounterparty") && amt >= LARGE_RUPIAH) {
            signals.add(RiskSignal.of("new_counterparty_large", "network",
                    "Lawan transaksi baru bernilai besar", 55,
                    "Transfer pertama ke " + event.destParty() + " senilai " + Features.rupiah(amt)));
        }
        if (fanOut >= 5) {
            int points = (int) Math.min(85, 55 + (fanOut - 5) * 6);
            signals.add(RiskSignal.of("fan_out", "network",
                    "Penyebaran ke banyak penerima (pola mule)", points,
                    "Akun mengirim ke " + fanOut + " penerima berbeda dalam 24 jam"));
        }
        return signals;
    }
}
