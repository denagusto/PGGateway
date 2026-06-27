package com.pggateway.fds.scoring.detectors;

import com.pggateway.fds.scoring.Detector;
import com.pggateway.fds.scoring.RiskSignal;
import com.pggateway.fds.scoring.WatchlistStore;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The WATCHLIST / SANCTIONS layer. A near-deterministic signal: if either side of the transaction
 * is on the blocklist (known mule, sanctioned party, DTTOT), the case is almost certainly
 * reportable. Highest single-signal weight in the system.
 */
@Component
public class WatchlistDetector implements Detector {

    private final WatchlistStore watchlist;

    public WatchlistDetector(WatchlistStore watchlist) {
        this.watchlist = watchlist;
    }

    @Override
    public List<RiskSignal> evaluate(CanonicalEvent event, Map<String, Object> features) {
        List<RiskSignal> signals = new ArrayList<>();
        if (watchlist.isBlocked(event.sourceParty())) {
            signals.add(RiskSignal.of("watchlist_source", "watchlist",
                    "Pengirim ada di daftar pantau", 95,
                    "Akun pengirim " + event.sourceParty() + " masuk daftar pantau"));
        }
        if (watchlist.isBlocked(event.destParty())) {
            signals.add(RiskSignal.of("watchlist_dest", "watchlist",
                    "Penerima ada di daftar pantau", 95,
                    "Akun penerima " + event.destParty() + " masuk daftar pantau"));
        }
        return signals;
    }
}
