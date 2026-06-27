package com.pggateway.recon;

import com.pggateway.eventstore.InMemoryEventStore;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

class ReconciliationServiceTest {

    private CanonicalEvent ev(String ref, long amountMinor) {
        return new CanonicalEvent("e-" + ref, "idem-" + ref, ref, Channel.TRANSFER, amountMinor,
                "IDR", Instant.now(), "acc", "merchant", "00", "acc-" + ref, null, "rawref");
    }

    @Test
    void matches_flags_selisih_and_satu_sisi() {
        InMemoryEventStore store = new InMemoryEventStore();
        store.append(ev("R1", 1000));
        store.append(ev("R2", 2000));
        store.append(ev("R3", 3000));
        ReconciliationService recon = new ReconciliationService(store);
        recon.addCounterparty("R1", 1000); // matched
        recon.addCounterparty("R2", 1900); // amount differs -> selisih
        // R3 has no counterparty -> satu sisi (ledger only)
        recon.addCounterparty("R4", 500);  // counterparty only -> satu sisi

        Map<String, Mismatch> byRef = recon.mismatches().stream()
                .collect(Collectors.toMap(Mismatch::txnRef, Function.identity()));
        assertEquals(3, byRef.size());
        assertEquals("selisih_nominal", byRef.get("R2").type());
        assertEquals(100L, byRef.get("R2").diffMinor());
        assertEquals("satu_sisi", byRef.get("R3").type());
        assertNull(byRef.get("R3").amountCounterpartyMinor());
        assertEquals("satu_sisi", byRef.get("R4").type());
        assertNull(byRef.get("R4").amountPjpMinor());

        var s = recon.summary();
        assertEquals(1, s.matched());          // R1
        assertEquals(3, s.mismatchOpen());

        recon.resolve("R2");
        assertEquals(2, recon.mismatches().size());
        assertEquals(2, recon.summary().mismatchOpen());
    }
}
