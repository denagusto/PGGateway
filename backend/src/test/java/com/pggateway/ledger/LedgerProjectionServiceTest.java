package com.pggateway.ledger;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LedgerProjectionServiceTest {

    private CanonicalEvent ev(String src, String dst, long amountMinor, int i) {
        return new CanonicalEvent("e" + i, "idem" + i, "REF" + i, Channel.TRANSFER,
                amountMinor, "IDR", Instant.now(), src, dst, "00", src, null, "ref");
    }

    private long balance(List<AccountBalance> accs, String acc) {
        return accs.stream().filter(a -> a.account().equals(acc)).findFirst().orElseThrow().balanceMinor();
    }

    @Test
    void double_entry_legs_sum_to_zero() {
        LedgerProjectionService svc = new LedgerProjectionService();
        svc.apply(ev("ACC-A", "ACC-B", 1000L, 0));
        List<AccountBalance> accs = svc.accounts(10);
        // structural double-entry: across all accounts the legs net to zero
        assertEquals(0L, accs.stream().mapToLong(AccountBalance::balanceMinor).sum());
        assertEquals(-1000L, balance(accs, "ACC-A")); // source debited
        assertEquals(1000L, balance(accs, "ACC-B"));  // destination credited
    }

    @Test
    void aggregates_volume_and_distinct_accounts() {
        LedgerProjectionService svc = new LedgerProjectionService();
        svc.apply(ev("ACC-A", "ACC-M", 500L, 0));
        svc.apply(ev("ACC-B", "ACC-M", 300L, 1));
        assertEquals(800L, svc.totalVolumeMinor());
        assertEquals(3, svc.distinctAccounts()); // A, B, M
        assertEquals(2L, svc.processedCount());
    }
}
