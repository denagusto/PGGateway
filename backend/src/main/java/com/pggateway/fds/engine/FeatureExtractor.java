package com.pggateway.fds.engine;

import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * The FEATURE STORE (layer 2 of the FDS): turns "this transaction" plus "what this account
 * usually does" into the feature vocabulary the rules and detectors reference. In production the
 * per-account profile lives in Redis for sub-10ms lookup; here it is an in-memory stand-in with
 * the same shape.
 *
 * State is a per-account behavioral PROFILE, keyed by (tenant, account) so two PJPs never share a
 * baseline. Each profile keeps a 24h sliding window, an all-time counterparty set, and streaming
 * mean/variance (Welford) of transaction amounts — the baseline an anomaly is measured against.
 *
 * Features exposed (SpEL variables / detector inputs):
 *   amountMinor, amountRupiah        (long)
 *   velocity10s/1m/10m/1h/24h        (int)    rolling transaction counts
 *   subThreshold24h                  (int)    txns in [Rp250jt, Rp500jt)  (structuring)
 *   aggregate24hMinor                (long)   total amount in 24h
 *   amountMeanMinor, amountStdMinor  (long)   account baseline (prior to this txn)
 *   amountZScore                     (double) deviation of this amount from the baseline (σ)
 *   newCounterparty                  (boolean) first time this account pays this counterparty
 *   fanOut24h                        (int)    distinct counterparties paid in 24h (mule fan-out)
 *   distinctCounterparties           (int)    all-time distinct counterparties
 *   hourOfDayWib                     (int)    0–23 local (WIB, UTC+7)
 *   offHours                         (boolean) hourOfDayWib < 6
 *   roundAmount                      (boolean) exact multiple of Rp 1.000.000
 *   secsSinceLast                    (long)    seconds since the account's previous txn (-1 if first)
 *   channel, account, tenant         (String)
 */
@Component
public class FeatureExtractor {

    private static final long SHORT_WINDOW_SEC = 10;
    private static final long MIN_SEC = 60;
    private static final long TEN_MIN_SEC = 600;
    private static final long HOUR_SEC = 3_600;
    private static final long DAY_SEC = 86_400;
    private static final long WIB_OFFSET_SEC = 7 * HOUR_SEC;
    private static final long SUB_LOW_MINOR = 25_000_000_000L;   // Rp 250.000.000
    private static final long SUB_HIGH_MINOR = 50_000_000_000L;  // Rp 500.000.000
    private static final long ONE_MILLION_MINOR = 100_000_000L;  // Rp 1.000.000 in minor units

    private static final class Profile {
        final Deque<long[]> window = new ArrayDeque<>();     // [epochSec, amountMinor] within 24h
        final Deque<Object[]> dests = new ArrayDeque<>();    // [epochSec(Long), dest(String)] within 24h
        final Set<String> counterparties = new HashSet<>();  // all-time
        long n;            // count for Welford
        double mean;       // running mean (minor units)
        double m2;         // running sum of squares of differences
        long lastSec = -1; // previous txn time
    }

    /** "(tenant) (account)" -> profile */
    private final Map<String, Profile> profiles = new HashMap<>();

    public synchronized Map<String, Object> extract(CanonicalEvent e) {
        long now = e.occurredAt().getEpochSecond();
        long amt = e.amountMinor();
        String dest = e.destParty();
        String key = (e.tenantId() == null ? "" : e.tenantId()) + " " + e.partitionKey();
        Profile p = profiles.computeIfAbsent(key, k -> new Profile());

        // --- snapshot the PRIOR baseline (anomaly is measured against history, not including now) ---
        long priorN = p.n;
        double priorMean = p.mean;
        double priorStd = priorN >= 2 ? Math.sqrt(p.m2 / (priorN - 1)) : 0.0;
        long priorLast = p.lastSec;
        boolean newCounterparty = dest != null && !dest.isBlank() && !p.counterparties.contains(dest);

        // --- advance state ---
        p.window.addLast(new long[]{now, amt});
        while (!p.window.isEmpty() && p.window.peekFirst()[0] < now - DAY_SEC) p.window.pollFirst();
        if (dest != null && !dest.isBlank()) {
            p.dests.addLast(new Object[]{now, dest});
            p.counterparties.add(dest);
        }
        while (!p.dests.isEmpty() && (Long) p.dests.peekFirst()[0] < now - DAY_SEC) p.dests.pollFirst();
        // Welford online mean/variance update
        p.n++;
        double delta = amt - p.mean;
        p.mean += delta / p.n;
        p.m2 += delta * (amt - p.mean);
        p.lastSec = now;

        // --- windowed aggregates over the 24h window ---
        int v10s = 0, v1m = 0, v10m = 0, v1h = 0, v24h = 0, sub24h = 0;
        long agg24h = 0;
        for (long[] row : p.window) {
            long t = row[0], a = row[1];
            v24h++;
            agg24h += a;
            if (t >= now - HOUR_SEC) v1h++;
            if (t >= now - TEN_MIN_SEC) v10m++;
            if (t >= now - MIN_SEC) v1m++;
            if (t >= now - SHORT_WINDOW_SEC) v10s++;
            if (a >= SUB_LOW_MINOR && a < SUB_HIGH_MINOR) sub24h++;
        }
        Set<String> distinct24h = new HashSet<>();
        for (Object[] d : p.dests) distinct24h.add((String) d[1]);

        double z = (priorN >= 5 && priorStd > 0) ? (amt - priorMean) / priorStd : 0.0;
        int hourWib = (int) (((now + WIB_OFFSET_SEC) / HOUR_SEC) % 24);

        Map<String, Object> f = new HashMap<>();
        f.put("amountMinor", amt);
        f.put("amountRupiah", amt / 100);
        f.put("velocity10s", v10s);
        f.put("velocity1m", v1m);
        f.put("velocity10m", v10m);
        f.put("velocity1h", v1h);
        f.put("velocity24h", v24h);
        f.put("subThreshold24h", sub24h);
        f.put("aggregate24hMinor", agg24h);
        f.put("amountMeanMinor", (long) priorMean);
        f.put("amountStdMinor", (long) priorStd);
        f.put("amountZScore", round2(z));
        f.put("newCounterparty", newCounterparty);
        f.put("fanOut24h", distinct24h.size());
        f.put("distinctCounterparties", p.counterparties.size());
        f.put("hourOfDayWib", hourWib);
        f.put("offHours", hourWib < 6);
        f.put("roundAmount", amt % ONE_MILLION_MINOR == 0);
        f.put("secsSinceLast", priorLast < 0 ? -1L : now - priorLast);
        f.put("channel", e.channel().name());
        f.put("account", e.partitionKey());
        f.put("tenant", e.tenantId());
        return f;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
