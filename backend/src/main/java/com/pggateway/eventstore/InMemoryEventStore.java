package com.pggateway.eventstore;

import com.pggateway.ingest.CanonicalEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

/**
 * In-memory append-only store for T1.
 *
 *   append(e)
 *     └─ lock(partitionKey)            ◄─ per-account serialization (basis for stateful invariants later)
 *          ├─ seen idempotencyKey?  ── yes ─► DUPLICATE (drop)
 *          ├─ assign per-partition seq (monotonic)
 *          ├─ detect gaps vs upstreamSeq
 *          └─ record + append to log ──────► APPENDED
 *
 * Not durable, not for production — a faithful behavioral stand-in until the Kafka/CockroachDB
 * store lands (T2/T3).
 */
@Component
@Profile("!cockroach")
public class InMemoryEventStore implements EventStore {

    private final Map<String, Long> seenIdempotency = new ConcurrentHashMap<>();   // idemKey -> seq
    private final Map<String, AtomicLong> partitionSeq = new ConcurrentHashMap<>();
    private final Map<String, Long> lastUpstreamSeq = new ConcurrentHashMap<>();
    private final Map<String, Object> locks = new ConcurrentHashMap<>();
    private final Deque<CanonicalEvent> log = new ConcurrentLinkedDeque<>();

    @Override
    public AppendResult append(CanonicalEvent e) {
        Object lock = locks.computeIfAbsent(e.partitionKey(), k -> new Object());
        synchronized (lock) {
            Long existingSeq = seenIdempotency.get(e.idempotencyKey());
            if (existingSeq != null) {
                return new AppendResult(AppendOutcome.DUPLICATE, existingSeq, List.of());
            }
            long seq = partitionSeq.computeIfAbsent(e.partitionKey(), k -> new AtomicLong())
                    .incrementAndGet();
            List<Long> gaps = detectGaps(e);
            seenIdempotency.put(e.idempotencyKey(), seq);
            log.addLast(e);
            return new AppendResult(AppendOutcome.APPENDED, seq, gaps);
        }
    }

    /** Detect missing upstream sequence numbers for this partition (caller already holds the lock). */
    private List<Long> detectGaps(CanonicalEvent e) {
        if (e.upstreamSeq() == null) return List.of();
        Long last = lastUpstreamSeq.get(e.partitionKey());
        List<Long> gaps = new ArrayList<>();
        if (last != null && e.upstreamSeq() > last + 1) {
            for (long s = last + 1; s < e.upstreamSeq(); s++) gaps.add(s);
        }
        if (last == null || e.upstreamSeq() > last) {
            lastUpstreamSeq.put(e.partitionKey(), e.upstreamSeq());
        }
        return gaps;
    }

    @Override
    public List<CanonicalEvent> recent(int limit, String tenantId) {
        List<CanonicalEvent> all = new ArrayList<>(log);
        Collections.reverse(all); // newest first
        List<CanonicalEvent> out = new ArrayList<>();
        for (CanonicalEvent e : all) {
            if (tenantId == null || tenantId.equals(e.tenantId())) {
                out.add(e);
                if (out.size() >= limit) break;
            }
        }
        return List.copyOf(out);
    }

    @Override
    public int size(String tenantId) {
        if (tenantId == null) return log.size();
        int n = 0;
        for (CanonicalEvent e : log) if (tenantId.equals(e.tenantId())) n++;
        return n;
    }
}
