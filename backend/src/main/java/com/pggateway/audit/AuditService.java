package com.pggateway.audit;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedDeque;

/** Append-only audit trail of sensitive actions. In-memory now; later a durable store. */
@Service
public class AuditService {

    private static final String ACTOR = "operator@tenant-demo";

    private final Deque<AuditEntry> log = new ConcurrentLinkedDeque<>();

    public void append(String action, String target, String detail) {
        log.addLast(new AuditEntry(UUID.randomUUID().toString(), Instant.now(), ACTOR,
                action, target == null ? "" : target, detail == null ? "" : detail));
    }

    public List<AuditEntry> recent(int limit) {
        List<AuditEntry> all = new ArrayList<>(log);
        int from = Math.max(0, all.size() - limit);
        List<AuditEntry> tail = new ArrayList<>(all.subList(from, all.size()));
        Collections.reverse(tail); // newest first
        return List.copyOf(tail);
    }
}
