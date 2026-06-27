package com.pggateway.ledger.gl;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.live.LiveBus;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The multi-tier double-entry general ledger.
 *
 *   Tier 1 — Journal: every captured payment becomes a balanced {@link JournalEntry}.
 *   Tier 2 — Sub-ledger: per-merchant payable sub-accounts under control account 2000.
 *   Tier 3 — General ledger: debit/credit totals per account, rolled into the chart of accounts.
 *   Tier 4 — Trial balance: Σ debit balances == Σ credit balances (provable at all times).
 *   Plus  — Fund safeguarding: customer/merchant liabilities vs the assets that back them.
 *
 * Acquiring posting model (fee = MDR over the amount):
 *   DEBIT  Settlement-Clearing (asset)     amount
 *   CREDIT Merchant-Payable:&lt;merchant&gt;     amount - fee
 *   CREDIT Fee-Revenue                      fee
 *
 * Partitioned per tenant (PJP). Like the FDS/projection, decoupled from ingest via a worker so a
 * slow ledger can't back-pressure the write path.
 */
@Service
public class GeneralLedgerService {

    /** Merchant discount rate in basis points (0.70%). Configurable later; constant for now. */
    private static final long MDR_BPS = 70;

    private final ChartOfAccounts chart;

    // tenant -> accountCode -> [debitSum, creditSum]
    private final Map<String, Map<String, long[]>> balances = new ConcurrentHashMap<>();
    // tenant -> journal (newest last)
    private final Map<String, Deque<JournalEntry>> journals = new ConcurrentHashMap<>();
    // accountCode -> metadata (name/type), shared across tenants
    private final Map<String, Account> meta = new ConcurrentHashMap<>();

    private final ExecutorService worker = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "general-ledger");
        t.setDaemon(true);
        return t;
    });

    private final LiveBus live; // nullable in unit tests

    @Autowired
    public GeneralLedgerService(ChartOfAccounts chart, LiveBus live) {
        this.chart = chart;
        this.live = live;
    }

    /** Test constructor — no live stream. */
    public GeneralLedgerService(ChartOfAccounts chart) {
        this(chart, null);
    }

    private static String tenantOf(CanonicalEvent e) {
        return (e.tenantId() == null || e.tenantId().isBlank()) ? "PJP-DEMO" : e.tenantId();
    }

    /** Async — used by the ingest path. */
    public void submit(CanonicalEvent e) {
        worker.execute(() -> apply(e));
    }

    /** Synchronous posting (also used by the seeder and tests). */
    public synchronized void apply(CanonicalEvent e) {
        String tenant = tenantOf(e);
        long amount = e.amountMinor();
        long fee = amount * MDR_BPS / 10_000;
        long net = amount - fee;
        String merchant = (e.destParty() == null || e.destParty().isBlank()) ? "UNKNOWN" : e.destParty();

        Account clearing = chart.get(ChartOfAccounts.SETTLEMENT_CLEARING);
        Account payable = chart.merchantPayable(merchant);
        Account feeRev = chart.get(ChartOfAccounts.FEE_REVENUE);

        List<Posting> postings = new ArrayList<>();
        postings.add(Posting.debit(clearing, amount));
        if (net > 0) postings.add(Posting.credit(payable, net));
        if (fee > 0) postings.add(Posting.credit(feeRev, fee));

        JournalEntry entry = new JournalEntry(
                UUID.randomUUID().toString(), tenant, e.txnRef(), e.occurredAt(),
                e.channel().name() + " — settle " + merchant, postings); // throws if unbalanced

        Deque<JournalEntry> journal = journals.computeIfAbsent(tenant, k -> new ConcurrentLinkedDeque<>());
        journal.addLast(entry);
        Map<String, long[]> bal = balances.computeIfAbsent(tenant, k -> new ConcurrentHashMap<>());
        for (Posting p : postings) {
            meta.putIfAbsent(p.accountCode(), new Account(p.accountCode(), p.accountName(), p.type(),
                    p.accountCode().startsWith(ChartOfAccounts.MERCHANT_PAYABLE + ":") ? ChartOfAccounts.MERCHANT_PAYABLE : null));
            long[] dc = bal.computeIfAbsent(p.accountCode(), k -> new long[2]);
            dc[p.debit() ? 0 : 1] += p.amountMinor();
        }
        if (live != null) live.publish("ledger");
    }

    /** Balances for one tenant, or aggregated across all tenants when {@code tenantId} is null. */
    private Map<String, long[]> balancesFor(String tenantId) {
        if (tenantId != null) return balances.getOrDefault(tenantId, Map.of());
        Map<String, long[]> agg = new HashMap<>();
        for (Map<String, long[]> m : balances.values()) {
            for (Map.Entry<String, long[]> en : m.entrySet()) {
                long[] dc = agg.computeIfAbsent(en.getKey(), k -> new long[2]);
                dc[0] += en.getValue()[0];
                dc[1] += en.getValue()[1];
            }
        }
        return agg;
    }

    /** General ledger: every account with activity for the tenant, with its balance. */
    public List<LedgerLine> generalLedger(String tenantId) {
        Map<String, long[]> bal = balancesFor(tenantId);
        List<LedgerLine> out = new ArrayList<>();
        for (Map.Entry<String, long[]> en : bal.entrySet()) {
            Account a = meta.get(en.getKey());
            if (a == null) continue;
            long debit = en.getValue()[0], credit = en.getValue()[1];
            out.add(new LedgerLine(a.code(), a.name(), a.type().name(), a.parentCode(),
                    debit, credit, normalBalance(a.type(), debit, credit)));
        }
        out.sort(Comparator.comparing(LedgerLine::code));
        return out;
    }

    /** Trial balance: each account's net on its balance side; total debits must equal total credits. */
    public TrialBalance trialBalance(String tenantId) {
        Map<String, long[]> bal = balancesFor(tenantId);
        List<TrialLine> lines = new ArrayList<>();
        long totalDebit = 0, totalCredit = 0;
        for (Map.Entry<String, long[]> en : bal.entrySet()) {
            Account a = meta.get(en.getKey());
            if (a == null) continue;
            long net = en.getValue()[0] - en.getValue()[1]; // debit - credit
            long debitCol = net > 0 ? net : 0;
            long creditCol = net < 0 ? -net : 0;
            if (debitCol == 0 && creditCol == 0) continue;
            totalDebit += debitCol;
            totalCredit += creditCol;
            lines.add(new TrialLine(a.code(), a.name(), a.type().name(), debitCol, creditCol));
        }
        lines.sort(Comparator.comparing(TrialLine::code));
        return new TrialBalance(lines, totalDebit, totalCredit, totalDebit == totalCredit);
    }

    /** Fund safeguarding: liabilities owed to customers/merchants vs the assets backing them. */
    public Safeguarding safeguarding(String tenantId) {
        Map<String, long[]> bal = balancesFor(tenantId);
        long assets = 0, liabilities = 0, revenue = 0;
        for (Map.Entry<String, long[]> en : bal.entrySet()) {
            Account a = meta.get(en.getKey());
            if (a == null) continue;
            long debit = en.getValue()[0], credit = en.getValue()[1];
            switch (a.type()) {
                case ASSET -> assets += debit - credit;
                case LIABILITY -> liabilities += credit - debit;
                case REVENUE -> revenue += credit - debit;
                default -> { }
            }
        }
        long coveragePct = liabilities == 0 ? 0 : Math.round(assets * 100.0 / liabilities);
        return new Safeguarding(liabilities, assets, assets - liabilities, revenue, coveragePct);
    }

    /** Recent journal entries, newest first. {@code tenantId} null = all tenants. */
    public List<JournalEntry> journal(String tenantId, int limit) {
        List<JournalEntry> all = new ArrayList<>();
        if (tenantId != null) {
            all.addAll(journals.getOrDefault(tenantId, new ConcurrentLinkedDeque<>()));
        } else {
            for (Deque<JournalEntry> d : journals.values()) all.addAll(d);
        }
        all.sort(Comparator.comparing(JournalEntry::occurredAt).reversed());
        return all.size() > limit ? List.copyOf(all.subList(0, limit)) : List.copyOf(all);
    }

    private static long normalBalance(AccountType type, long debit, long credit) {
        return type.normal() == AccountType.Normal.DEBIT ? debit - credit : credit - debit;
    }

    // ---- response shapes ----
    public record LedgerLine(String code, String name, String type, String parentCode,
                             long debitMinor, long creditMinor, long balanceMinor) {}

    public record TrialLine(String code, String name, String type, long debitMinor, long creditMinor) {}

    public record TrialBalance(List<TrialLine> lines, long totalDebitMinor, long totalCreditMinor,
                               boolean balanced) {}

    public record Safeguarding(long customerFundsMinor, long backingAssetsMinor, long surplusMinor,
                               long feeRevenueMinor, long coveragePct) {}
}
