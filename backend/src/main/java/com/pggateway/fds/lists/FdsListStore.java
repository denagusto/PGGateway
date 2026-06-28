package com.pggateway.fds.lists;

import com.pggateway.fds.lists.FdsListEntry.EntityType;
import com.pggateway.fds.lists.FdsListEntry.ListAction;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Runtime-editable FDS lists — the comprehensive successor to the single-purpose account blocklist.
 * Holds block / warning / allow entries across several identifier kinds (account, BIN, device, IP,
 * country). The {@link FdsListDetector} consults it during scoring; the risk/fraud team manages it
 * from the FDS Console. In-memory + thread-safe for now (durable store swaps in later).
 */
@Component
public class FdsListStore {

    private final ConcurrentHashMap<String, FdsListEntry> entries = new ConcurrentHashMap<>();

    public FdsListStore() {
        // A few seed entries so the console and detector are demonstrably live.
        seed(ListAction.BLOCK, EntityType.ACCOUNT, "ACC-mule-001", "Mule terkonfirmasi (laporan PPATK)");
        seed(ListAction.BLOCK, EntityType.COUNTRY, "KP", "Yurisdiksi sanksi");
        seed(ListAction.WARNING, EntityType.ACCOUNT, "ACC-watch-77", "Pola structuring, dalam pemantauan");
        seed(ListAction.ALLOW, EntityType.ACCOUNT, "ACC-payroll-gov", "Akun payroll tepercaya — kurangi noise");
    }

    private void seed(ListAction a, EntityType t, String v, String reason) {
        FdsListEntry e = new FdsListEntry(UUID.randomUUID().toString(), a, t, v, reason, Instant.EPOCH);
        entries.put(e.id(), e);
    }

    public FdsListEntry add(ListAction action, EntityType type, String value, String reason) {
        // De-dupe on (action, type, value): re-adding refreshes the reason rather than duplicating.
        remove(action, type, value);
        FdsListEntry e = new FdsListEntry(UUID.randomUUID().toString(), action, type,
                value.trim(), reason == null ? "" : reason.trim(), Instant.now());
        entries.put(e.id(), e);
        return e;
    }

    public boolean removeById(String id) {
        return entries.remove(id) != null;
    }

    private void remove(ListAction action, EntityType type, String value) {
        entries.values().removeIf(e -> e.action() == action && e.entityType() == type
                && e.value().equalsIgnoreCase(value.trim()));
    }

    public List<FdsListEntry> all() {
        return entries.values().stream()
                .sorted(Comparator.comparing(FdsListEntry::action).thenComparing(FdsListEntry::entityType)
                        .thenComparing(FdsListEntry::value))
                .collect(Collectors.toList());
    }

    /** The action attached to an account value, if any — used by the detector for source/dest. */
    public Optional<ListAction> accountAction(String account) {
        if (account == null) return Optional.empty();
        return entries.values().stream()
                .filter(e -> e.entityType() == EntityType.ACCOUNT && e.value().equalsIgnoreCase(account))
                .map(FdsListEntry::action)
                // BLOCK dominates WARNING dominates ALLOW if multiple ever coexist
                .min(Comparator.comparingInt(a -> switch (a) { case BLOCK -> 0; case WARNING -> 1; case ALLOW -> 2; }));
    }
}
