package com.pggateway.ledger;

import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Async, partitioned ledger projection — the "L" in PGGateway.
 *
 * Each transaction posts two STRUCTURAL double-entry legs that sum to zero:
 *   debit source (-amount), credit destination (+amount).
 * Balances are derived from the event stream (event sourcing), never mutated directly.
 *
 * Decoupled from ingest via a single worker thread (a slow projection cannot back-pressure
 * the ledger write). In production this becomes a Kafka consumer-group writing CockroachDB,
 * sharded per account — the same per-account keying used here.
 */
@Service
public class LedgerProjectionService {

    // Partitioned per tenant (PJP): tenant -> account -> balance/count. Same account name under two
    // tenants is two distinct balances — that's the data isolation boundary.
    private final Map<String, Map<String, Long>> balanceMinor = new ConcurrentHashMap<>();
    private final Map<String, Map<String, Integer>> txnCount = new ConcurrentHashMap<>();
    private final Map<String, AtomicLong> volumeByTenant = new ConcurrentHashMap<>();
    private final AtomicLong processed = new AtomicLong();

    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "ledger-projection");
        t.setDaemon(true);
        return t;
    });

    private static String tenantOf(CanonicalEvent e) {
        return (e.tenantId() == null || e.tenantId().isBlank()) ? "PJP-DEMO" : e.tenantId();
    }

    /** Async — used by the ingest path. */
    public void submit(CanonicalEvent e) {
        worker.execute(() -> apply(e));
    }

    /** Synchronous projection step (also used by the seeder and tests). */
    public void apply(CanonicalEvent e) {
        String t = tenantOf(e);
        Map<String, Long> bal = balanceMinor.computeIfAbsent(t, k -> new ConcurrentHashMap<>());
        Map<String, Integer> cnt = txnCount.computeIfAbsent(t, k -> new ConcurrentHashMap<>());
        // structural double-entry: the two legs sum to zero
        bal.merge(e.sourceParty(), -e.amountMinor(), Long::sum);
        cnt.merge(e.sourceParty(), 1, Integer::sum);
        if (e.destParty() != null && !e.destParty().isBlank()) {
            bal.merge(e.destParty(), e.amountMinor(), Long::sum);
            cnt.merge(e.destParty(), 1, Integer::sum);
        }
        volumeByTenant.computeIfAbsent(t, k -> new AtomicLong()).addAndGet(e.amountMinor());
        processed.incrementAndGet();
    }

    /** Account balances across all tenants, most active first. */
    public List<AccountBalance> accounts(int limit) {
        return accounts(limit, null);
    }

    /** Account balances, most active first. {@code tenantId} null = all tenants (platform view). */
    public List<AccountBalance> accounts(int limit, String tenantId) {
        List<AccountBalance> out = new ArrayList<>();
        for (Map.Entry<String, Map<String, Long>> te : balanceMinor.entrySet()) {
            if (tenantId != null && !tenantId.equals(te.getKey())) continue;
            Map<String, Integer> cnt = txnCount.getOrDefault(te.getKey(), Map.of());
            for (Map.Entry<String, Long> ae : te.getValue().entrySet()) {
                out.add(new AccountBalance(te.getKey(), ae.getKey(), ae.getValue(),
                        cnt.getOrDefault(ae.getKey(), 0)));
            }
        }
        out.sort(Comparator.comparingInt(AccountBalance::txnCount).reversed());
        return out.size() > limit ? List.copyOf(out.subList(0, limit)) : List.copyOf(out);
    }

    public long totalVolumeMinor() {
        return totalVolumeMinor(null);
    }

    /** Total volume. {@code tenantId} null = all tenants. */
    public long totalVolumeMinor(String tenantId) {
        if (tenantId != null) {
            AtomicLong v = volumeByTenant.get(tenantId);
            return v == null ? 0 : v.get();
        }
        long s = 0;
        for (AtomicLong v : volumeByTenant.values()) s += v.get();
        return s;
    }

    public int distinctAccounts() {
        return distinctAccounts(null);
    }

    /** Distinct (tenant, account) pairs. {@code tenantId} null = all tenants. */
    public int distinctAccounts(String tenantId) {
        if (tenantId != null) {
            Map<String, Long> m = balanceMinor.get(tenantId);
            return m == null ? 0 : m.size();
        }
        int s = 0;
        for (Map<String, Long> m : balanceMinor.values()) s += m.size();
        return s;
    }

    public long processedCount() {
        return processed.get();
    }
}
