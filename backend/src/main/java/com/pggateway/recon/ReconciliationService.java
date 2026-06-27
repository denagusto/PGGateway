package com.pggateway.recon;

import com.pggateway.eventstore.EventStore;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Two-way reconciliation: PGGateway ledger (PJP side, from the event store) vs the counterparty/
 * settlement feed. Matches by txnRef; flags amount differences and one-sided transactions.
 * In-memory demo feed; production reconciles against PTEN/switching/settlement data.
 */
@Service
public class ReconciliationService {

    private final EventStore store;
    private final Map<String, Long> counterparty = new ConcurrentHashMap<>(); // txnRef -> amountMinor
    private final Set<String> resolved = ConcurrentHashMap.newKeySet();

    public ReconciliationService(EventStore store) {
        this.store = store;
    }

    public void addCounterparty(String txnRef, long amountMinor) {
        counterparty.put(txnRef, amountMinor);
    }

    public void removeCounterparty(String txnRef) {
        counterparty.remove(txnRef);
    }

    public boolean resolve(String txnRef) {
        resolved.add(txnRef);
        return true;
    }

    private Map<String, Long> pjpByRef() {
        Map<String, Long> m = new HashMap<>();
        for (CanonicalEvent e : store.recent(10_000)) m.putIfAbsent(e.txnRef(), e.amountMinor());
        return m;
    }

    /** Open mismatches (resolved excluded). */
    public List<Mismatch> mismatches() {
        Map<String, Long> pjp = pjpByRef();
        Set<String> refs = new HashSet<>(pjp.keySet());
        refs.addAll(counterparty.keySet());
        List<Mismatch> out = new ArrayList<>();
        for (String ref : refs) {
            Long p = pjp.get(ref);
            Long c = counterparty.get(ref);
            if (p != null && c != null && p.equals(c)) continue; // matched
            if (resolved.contains(ref)) continue;                // already handled
            if (p != null && c != null) {
                out.add(new Mismatch(ref, ref, p, c, p - c, "selisih_nominal", false));
            } else {
                out.add(new Mismatch(ref, ref, p, c, null, "satu_sisi", false));
            }
        }
        out.sort(Comparator.comparing(Mismatch::txnRef));
        return out;
    }

    public Summary summary() {
        Map<String, Long> pjp = pjpByRef();
        Set<String> refs = new HashSet<>(pjp.keySet());
        refs.addAll(counterparty.keySet());
        int matched = 0, open = 0;
        long diffTotal = 0;
        for (String ref : refs) {
            Long p = pjp.get(ref), c = counterparty.get(ref);
            if (p != null && c != null && p.equals(c)) {
                matched++;
            } else if (!resolved.contains(ref)) {
                open++;
                if (p != null && c != null) diffTotal += Math.abs(p - c);
            }
        }
        return new Summary(matched, open, diffTotal);
    }

    public record Summary(int matched, int mismatchOpen, long diffMinorTotal) {}
}
