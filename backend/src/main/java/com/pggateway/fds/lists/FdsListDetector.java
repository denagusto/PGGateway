package com.pggateway.fds.lists;

import com.pggateway.fds.lists.FdsListEntry.ListAction;
import com.pggateway.fds.scoring.Detector;
import com.pggateway.fds.scoring.RiskSignal;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Scores transactions against the FDS lists. Either side on the BLOCK list is a near-certain
 * reportable case (95); the WARNING list raises a softer signal (55) for elevated monitoring.
 * ALLOW-listed parties intentionally raise nothing — that is the point of an allowlist (cut noise
 * on trusted accounts). Emits in the "watchlist" category, so it honours the same enable/weight
 * tuning as the rest of that layer.
 */
@Component
public class FdsListDetector implements Detector {

    private final FdsListStore lists;

    public FdsListDetector(FdsListStore lists) {
        this.lists = lists;
    }

    @Override
    public List<RiskSignal> evaluate(CanonicalEvent event, Map<String, Object> features) {
        List<RiskSignal> signals = new ArrayList<>();
        addFor(signals, event.sourceParty(), "Pengirim");
        addFor(signals, event.destParty(), "Penerima");
        return signals;
    }

    private void addFor(List<RiskSignal> signals, String account, String side) {
        if (account == null) return;
        lists.accountAction(account).ifPresent(action -> {
            if (action == ListAction.BLOCK) {
                signals.add(RiskSignal.of("list_block_" + side.toLowerCase(), "watchlist",
                        side + " masuk blocklist", 95,
                        "Akun " + account + " ada di blocklist FDS"));
            } else if (action == ListAction.WARNING) {
                signals.add(RiskSignal.of("list_warning_" + side.toLowerCase(), "watchlist",
                        side + " masuk warning list", 55,
                        "Akun " + account + " ada di warning list FDS — pantau"));
            }
            // ALLOW: deliberately no signal.
        });
    }
}
