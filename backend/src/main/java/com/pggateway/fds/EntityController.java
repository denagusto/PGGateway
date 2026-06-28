package com.pggateway.fds;

import com.pggateway.auth.TenantScope;
import com.pggateway.eventstore.EventStore;
import com.pggateway.fds.lists.FdsListEntry;
import com.pggateway.fds.lists.FdsListStore;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Entity 360 / investigation view (ADMIN/ANALYST only — locked in SecurityConfig). Aggregates
 * everything the FDS knows about one account into a single response: its transactions (as sender or
 * receiver), the alerts it triggered, whether it sits on any block/warning/allow list, its
 * counterparties, and headline stats. This is the analyst's drill-down cockpit — it ties the
 * separate FDS modules together around the entity under investigation.
 */
@RestController
@RequestMapping("/api/fds/entity")
public class EntityController {

    private static final int SCAN_LIMIT = 5000;

    private final EventStore events;
    private final AlertStore alerts;
    private final FdsListStore lists;
    private final TenantScope tenantScope;

    public EntityController(EventStore events, AlertStore alerts, FdsListStore lists, TenantScope tenantScope) {
        this.events = events;
        this.alerts = alerts;
        this.lists = lists;
        this.tenantScope = tenantScope;
    }

    @GetMapping("/{account}")
    public Entity360 view(@PathVariable String account) {
        String tenant = tenantScope.resolve(null); // null for platform-wide users → all tenants

        // Transactions involving this account on either side.
        List<Txn> txns = new ArrayList<>();
        long totalIn = 0, totalOut = 0;
        Map<String, int[]> cp = new LinkedHashMap<>(); // counterparty -> [count, sentTo, receivedFrom]
        for (CanonicalEvent e : events.recent(SCAN_LIMIT, tenant)) {
            boolean isSource = account.equalsIgnoreCase(e.sourceParty()) || account.equalsIgnoreCase(e.partitionKey());
            boolean isDest = account.equalsIgnoreCase(e.destParty());
            if (!isSource && !isDest) continue;
            String dir = isSource ? "OUT" : "IN";
            if (isSource) totalOut += e.amountMinor(); else totalIn += e.amountMinor();
            String other = isSource ? e.destParty() : e.sourceParty();
            if (other != null) {
                int[] c = cp.computeIfAbsent(other, k -> new int[3]);
                c[0]++; if (isSource) c[1]++; else c[2]++;
            }
            txns.add(new Txn(e.txnRef(), e.channel().name(), e.amountMinor(), dir, other, e.occurredAt()));
        }

        // Alerts raised for this account, across every status.
        List<AlertLite> accountAlerts = new ArrayList<>();
        int confirmedFraud = 0;
        for (AlertStatus st : AlertStatus.values()) {
            for (Alert a : alerts.list(st, SCAN_LIMIT, tenant)) {
                if (!account.equalsIgnoreCase(a.account())) continue;
                if (a.status() == AlertStatus.CONFIRMED_FRAUD) confirmedFraud++;
                accountAlerts.add(new AlertLite(a.alertId(), a.score(), a.band(), a.rule(),
                        a.report(), a.status().name(), a.createdAt()));
            }
        }

        // List memberships (block / warning / allow) for this account value.
        List<ListHit> listHits = lists.all().stream()
                .filter(en -> en.entityType() == FdsListEntry.EntityType.ACCOUNT && en.value().equalsIgnoreCase(account))
                .map(en -> new ListHit(en.action().name(), en.reason()))
                .toList();

        List<Counterparty> counterparties = cp.entrySet().stream()
                .map(en -> new Counterparty(en.getKey(), en.getValue()[0], en.getValue()[1], en.getValue()[2]))
                .sorted((a, b) -> Integer.compare(b.count(), a.count()))
                .limit(20)
                .toList();

        Stats stats = new Stats(txns.size(), accountAlerts.size(), confirmedFraud,
                counterparties.size(), totalIn, totalOut);

        return new Entity360(account, tenant, stats, listHits, txns, accountAlerts, counterparties);
    }

    // ---- DTOs ----
    public record Txn(String txnRef, String channel, long amountMinor, String direction, String counterparty, Instant occurredAt) {}
    public record AlertLite(String alertId, int score, String band, String rule, String report, String status, Instant createdAt) {}
    public record ListHit(String action, String reason) {}
    public record Counterparty(String account, int count, int sentTo, int receivedFrom) {}
    public record Stats(int txnCount, int alertCount, int confirmedFraud, int counterparties, long totalInMinor, long totalOutMinor) {}
    public record Entity360(String account, String tenant, Stats stats, List<ListHit> listHits,
                            List<Txn> transactions, List<AlertLite> alerts, List<Counterparty> counterparties) {}
}
