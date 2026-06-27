package com.pggateway.ledger;

import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Service;

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

    private final Map<String, Long> balanceMinor = new ConcurrentHashMap<>();
    private final Map<String, Integer> txnCount = new ConcurrentHashMap<>();
    private final AtomicLong totalVolumeMinor = new AtomicLong();
    private final AtomicLong processed = new AtomicLong();

    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "ledger-projection");
        t.setDaemon(true);
        return t;
    });

    /** Async — used by the ingest path. */
    public void submit(CanonicalEvent e) {
        worker.execute(() -> apply(e));
    }

    /** Synchronous projection step (also used by the seeder and tests). */
    public void apply(CanonicalEvent e) {
        // structural double-entry: the two legs sum to zero
        balanceMinor.merge(e.sourceParty(), -e.amountMinor(), Long::sum);
        txnCount.merge(e.sourceParty(), 1, Integer::sum);
        if (e.destParty() != null && !e.destParty().isBlank()) {
            balanceMinor.merge(e.destParty(), e.amountMinor(), Long::sum);
            txnCount.merge(e.destParty(), 1, Integer::sum);
        }
        totalVolumeMinor.addAndGet(e.amountMinor());
        processed.incrementAndGet();
    }

    /** Account balances, most active first. */
    public List<AccountBalance> accounts(int limit) {
        return balanceMinor.entrySet().stream()
                .map(en -> new AccountBalance(en.getKey(), en.getValue(),
                        txnCount.getOrDefault(en.getKey(), 0)))
                .sorted(Comparator.comparingInt(AccountBalance::txnCount).reversed())
                .limit(limit)
                .toList();
    }

    public long totalVolumeMinor() {
        return totalVolumeMinor.get();
    }

    public int distinctAccounts() {
        return balanceMinor.size();
    }

    public long processedCount() {
        return processed.get();
    }
}
