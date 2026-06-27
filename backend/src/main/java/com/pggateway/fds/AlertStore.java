package com.pggateway.fds;

import java.util.List;
import java.util.Optional;

/** Stores fraud alerts. In-memory for now; later backed by the durable store. */
public interface AlertStore {

    Alert create(Alert alert);

    /** True if there is already an OPEN alert for this account+rule (dedup). */
    boolean hasOpen(String account, String rule);

    /** Recent alerts, newest first. {@code statusFilter} null = any status. */
    List<Alert> list(AlertStatus statusFilter, int limit);

    Optional<Alert> get(String alertId);

    /** Apply a verdict (CONFIRMED_FRAUD / FALSE_POSITIVE). Returns the updated alert. */
    Optional<Alert> setVerdict(String alertId, AlertStatus verdict);
}
