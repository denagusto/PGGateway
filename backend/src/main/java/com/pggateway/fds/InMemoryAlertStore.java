package com.pggateway.fds;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Deque;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

/** In-memory alert store (T1/FDS stand-in; later CockroachDB). Read by HTTP threads, so thread-safe. */
@Component
public class InMemoryAlertStore implements AlertStore {

    private final Map<String, Alert> byId = new ConcurrentHashMap<>();
    private final Deque<String> order = new ConcurrentLinkedDeque<>(); // insertion order

    @Override
    public Alert create(Alert alert) {
        byId.put(alert.alertId(), alert);
        order.addLast(alert.alertId());
        return alert;
    }

    @Override
    public boolean hasOpen(String tenantId, String account, String rule) {
        for (Alert a : byId.values()) {
            if (a.status() == AlertStatus.OPEN && a.account().equals(account) && a.rule().equals(rule)
                    && java.util.Objects.equals(a.tenantId(), tenantId)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public List<Alert> list(AlertStatus statusFilter, int limit, String tenantId) {
        List<Alert> out = new ArrayList<>();
        Iterator<String> it = order.descendingIterator(); // newest first
        while (it.hasNext() && out.size() < limit) {
            Alert a = byId.get(it.next());
            if (a != null
                    && (statusFilter == null || a.status() == statusFilter)
                    && (tenantId == null || tenantId.equals(a.tenantId()))) {
                out.add(a);
            }
        }
        return List.copyOf(out);
    }

    @Override
    public Optional<Alert> get(String alertId) {
        return Optional.ofNullable(byId.get(alertId));
    }

    @Override
    public Optional<Alert> setVerdict(String alertId, AlertStatus verdict) {
        Alert a = byId.get(alertId);
        if (a == null) return Optional.empty();
        Alert updated = a.withStatus(verdict);
        byId.put(alertId, updated);
        return Optional.of(updated);
    }
}
