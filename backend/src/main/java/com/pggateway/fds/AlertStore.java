package com.pggateway.fds;

import java.util.List;
import java.util.Optional;

/** Stores fraud alerts. In-memory for now; later backed by the durable store. */
public interface AlertStore {

    Alert create(Alert alert);

    /** True if there is already an OPEN alert for this tenant+account+rule (dedup). */
    boolean hasOpen(String tenantId, String account, String rule);

    /** Recent alerts for one tenant, newest first. {@code statusFilter}/{@code tenantId} null = any. */
    List<Alert> list(AlertStatus statusFilter, int limit, String tenantId);

    /** Recent alerts across all tenants, newest first. */
    default List<Alert> list(AlertStatus statusFilter, int limit) {
        return list(statusFilter, limit, null);
    }

    Optional<Alert> get(String alertId);

    /** Apply a verdict (CONFIRMED_FRAUD / FALSE_POSITIVE). Returns the updated alert. */
    Optional<Alert> setVerdict(String alertId, AlertStatus verdict);
}
