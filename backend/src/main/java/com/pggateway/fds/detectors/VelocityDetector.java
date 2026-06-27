package com.pggateway.fds.detectors;

import com.pggateway.fds.FraudDetector;
import com.pggateway.fds.FraudSignal;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Flags an account doing too many transactions in a short window (a burst — common in
 * account-takeover / card-testing). State is per-account and only touched by the single FDS
 * worker thread, so no synchronization is needed here.
 */
@Component
public class VelocityDetector implements FraudDetector {

    static final int WINDOW_SECONDS = 10;
    static final int THRESHOLD = 5;

    private final Map<String, Deque<Instant>> recentByAccount = new HashMap<>();

    @Override
    public String name() {
        return "velocity_new_account";
    }

    @Override
    public FraudSignal evaluate(CanonicalEvent e) {
        Deque<Instant> window = recentByAccount.computeIfAbsent(e.partitionKey(), k -> new ArrayDeque<>());
        Instant now = e.occurredAt();
        window.addLast(now);
        Instant cutoff = now.minusSeconds(WINDOW_SECONDS);
        while (!window.isEmpty() && window.peekFirst().isBefore(cutoff)) {
            window.pollFirst();
        }
        int count = window.size();
        if (count >= THRESHOLD) {
            int score = Math.min(95, 60 + 6 * (count - THRESHOLD));
            return new FraudSignal(score, name(),
                    List.of(count + " transaksi dalam " + WINDOW_SECONDS + " detik",
                            "kecepatan transaksi tidak wajar"));
        }
        return null;
    }
}
