package com.pggateway.developer;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * In-memory ring buffer of recent ingest attempts — the data behind the Developer "Integration
 * Monitor". Every request that hits the SNAP-protected ingest path is recorded with its outcome
 * (accepted, bad signature, unknown key, replay, bad payload …), so an integrator can immediately
 * see whether their last "send event" worked and, if not, exactly why. Bounded so it never grows
 * unbounded; durable store swaps in later.
 */
@Component
public class IntegrationLog {

    public record Entry(Instant at, String clientKey, String tenantId, String method, String path,
                        int status, String code, String message, long latencyMs) {}

    private static final int MAX = 200;
    private final Deque<Entry> entries = new ArrayDeque<>();

    public synchronized void record(String clientKey, String tenantId, String method, String path,
                                    int status, String code, String message, long latencyMs) {
        entries.addFirst(new Entry(Instant.now(), mask(clientKey), tenantId, method, path,
                status, code, message, latencyMs));
        while (entries.size() > MAX) entries.removeLast();
    }

    /** Most recent attempts, optionally filtered to one client key. */
    public synchronized List<Entry> recent(int limit, String clientKey) {
        List<Entry> out = new ArrayList<>();
        for (Entry e : entries) {
            if (clientKey != null && !clientKey.isBlank() && !mask(clientKey).equals(e.clientKey())) continue;
            out.add(e);
            if (out.size() >= limit) break;
        }
        return out;
    }

    /** Show only a key prefix — never echo a full credential back to a console. */
    private static String mask(String key) {
        if (key == null || key.isBlank()) return "(tanpa key)";
        return key.length() <= 12 ? key : key.substring(0, 12) + "…";
    }
}
