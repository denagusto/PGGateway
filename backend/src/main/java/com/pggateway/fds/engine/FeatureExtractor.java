package com.pggateway.fds.engine;

import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;

/**
 * Computes the per-transaction FEATURE VOCABULARY that rule formulas reference. Rules combine
 * these features into conditions (see RuleEngine); the features are the fixed building blocks,
 * the rules are dynamic.
 *
 * Features exposed (SpEL variables):
 *   amountMinor       (long)  this transaction's amount (minor units, scale 2)
 *   amountRupiah      (long)  amountMinor / 100
 *   velocity10s       (int)   account's transaction count in the last 10 seconds
 *   velocity24h       (int)   account's transaction count in the last 24 hours
 *   subThreshold24h   (int)   account's txns in 24h with amount in [Rp 250jt, Rp 500jt)  (structuring)
 *   aggregate24hMinor (long)  account's total amount in the last 24 hours
 *   channel           (String)
 *   account           (String)
 *
 * State is per-account; touched only by the single FDS worker (synchronized for safety).
 */
@Component
public class FeatureExtractor {

    private static final long SHORT_WINDOW_SEC = 10;
    private static final long DAY_SEC = 86_400;
    private static final long SUB_LOW_MINOR = 25_000_000_000L;   // Rp 250.000.000
    private static final long SUB_HIGH_MINOR = 50_000_000_000L;  // Rp 500.000.000

    /** account -> deque of [epochSecond, amountMinor] within the last 24h */
    private final Map<String, Deque<long[]>> history = new HashMap<>();

    public synchronized Map<String, Object> extract(CanonicalEvent e) {
        long now = e.occurredAt().getEpochSecond();
        Deque<long[]> dq = history.computeIfAbsent(e.partitionKey(), k -> new ArrayDeque<>());
        dq.addLast(new long[]{now, e.amountMinor()});
        while (!dq.isEmpty() && dq.peekFirst()[0] < now - DAY_SEC) dq.pollFirst();

        int velocity10s = 0, velocity24h = 0, subThreshold24h = 0;
        long aggregate24h = 0;
        for (long[] row : dq) {
            long t = row[0], amt = row[1];
            velocity24h++;
            aggregate24h += amt;
            if (t >= now - SHORT_WINDOW_SEC) velocity10s++;
            if (amt >= SUB_LOW_MINOR && amt < SUB_HIGH_MINOR) subThreshold24h++;
        }

        Map<String, Object> f = new HashMap<>();
        f.put("amountMinor", e.amountMinor());
        f.put("amountRupiah", e.amountMinor() / 100);
        f.put("velocity10s", velocity10s);
        f.put("velocity24h", velocity24h);
        f.put("subThreshold24h", subThreshold24h);
        f.put("aggregate24hMinor", aggregate24h);
        f.put("channel", e.channel().name());
        f.put("account", e.partitionKey());
        return f;
    }
}
