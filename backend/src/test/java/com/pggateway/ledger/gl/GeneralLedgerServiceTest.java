package com.pggateway.ledger.gl;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class GeneralLedgerServiceTest {

    private CanonicalEvent payment(String tenant, String merchant, long amountMinor, int i) {
        return new CanonicalEvent("e" + i, tenant, "idem-" + tenant + "-" + i, "REF-" + i, Channel.QRIS,
                amountMinor, "IDR", Instant.now(), "payer", merchant, "00", "payer", null, "ref");
    }

    private GeneralLedgerService svc() {
        return new GeneralLedgerService(new ChartOfAccounts());
    }

    @Test
    void posts_a_balanced_entry_split_into_payable_and_fee() {
        GeneralLedgerService gl = svc();
        gl.apply(payment("PJP-DEMO", "ACC-merchant", 1_000_000_000L, 0)); // Rp 10 juta, MDR 0.70%

        var journal = gl.journal("PJP-DEMO", 10);
        assertEquals(1, journal.size());
        JournalEntry e = journal.get(0);
        assertEquals(3, e.postings().size()); // debit clearing + credit payable + credit fee
        long fee = e.postings().stream().filter(p -> p.accountCode().equals(ChartOfAccounts.FEE_REVENUE))
                .mapToLong(Posting::amountMinor).sum();
        assertEquals(7_000_000L, fee, "0.70% of Rp 10jt = Rp 70.000");
    }

    @Test
    void trial_balance_always_balances() {
        GeneralLedgerService gl = svc();
        gl.apply(payment("PJP-DEMO", "ACC-m1", 1_000_000_000L, 0));
        gl.apply(payment("PJP-DEMO", "ACC-m2", 500_000_000L, 1));
        gl.apply(payment("PJP-DEMO", "ACC-m1", 60_000_000_000L, 2));

        var tb = gl.trialBalance("PJP-DEMO");
        assertTrue(tb.balanced(), "Σdebit must equal Σcredit");
        assertEquals(tb.totalDebitMinor(), tb.totalCreditMinor());
        assertEquals(61_500_000_000L, tb.totalDebitMinor()); // sum of amounts sits on the debit (clearing) side
    }

    @Test
    void safeguarding_assets_fully_back_liabilities_surplus_is_fee() {
        GeneralLedgerService gl = svc();
        gl.apply(payment("PJP-DEMO", "ACC-merchant", 1_000_000_000L, 0));

        var sg = gl.safeguarding("PJP-DEMO");
        assertEquals(1_000_000_000L, sg.backingAssetsMinor());     // all funds held in clearing
        assertEquals(993_000_000L, sg.customerFundsMinor());       // owed to merchant (net)
        assertEquals(7_000_000L, sg.feeRevenueMinor());            // our fee
        assertEquals(sg.feeRevenueMinor(), sg.surplusMinor());     // surplus over liabilities == fee
        assertTrue(sg.coveragePct() >= 100, "assets must fully cover customer funds");
    }

    @Test
    void books_are_isolated_per_tenant_and_aggregate_with_null() {
        GeneralLedgerService gl = svc();
        gl.apply(payment("PJP-DEMO", "ACC-m", 1_000_000_000L, 0));
        gl.apply(payment("PJP-BETA", "ACC-m", 2_000_000_000L, 1));

        assertEquals(1_000_000_000L, gl.safeguarding("PJP-DEMO").backingAssetsMinor());
        assertEquals(2_000_000_000L, gl.safeguarding("PJP-BETA").backingAssetsMinor());
        assertEquals(3_000_000_000L, gl.safeguarding(null).backingAssetsMinor()); // consolidated
    }
}
