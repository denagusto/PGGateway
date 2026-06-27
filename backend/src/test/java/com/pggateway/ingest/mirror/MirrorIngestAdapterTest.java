package com.pggateway.ingest.mirror;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import com.pggateway.ingest.IngestException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MirrorIngestAdapterTest {

    private final MirrorIngestAdapter adapter = new MirrorIngestAdapter();

    private MirrorPayload valid() {
        return new MirrorPayload(
                "EXT-001", "REF-001", "QRIS_MPM",
                new MirrorPayload.Amount("75000.00", "IDR"),
                "ACC-9", "ACC-merchant", "00", 1L);
    }

    @Test
    void normalizes_valid_payload() {
        CanonicalEvent e = adapter.normalize(valid());
        assertEquals("EXT-001", e.idempotencyKey());
        assertEquals("REF-001", e.txnRef());
        assertEquals(Channel.QRIS, e.channel());
        assertEquals(7_500_000L, e.amountMinor());   // 75000.00 -> minor units (scale 2)
        assertEquals("IDR", e.currency());
        assertEquals("ACC-9", e.partitionKey());      // shard-per-account
        assertEquals(1L, e.upstreamSeq());
        assertNotNull(e.eventId());
        assertFalse(e.rawPayloadRef().contains("75000")); // ref is a pointer, not the data
    }

    @Test
    void duplicate_delivery_yields_same_idempotency_key() {
        CanonicalEvent a = adapter.normalize(valid());
        CanonicalEvent b = adapter.normalize(valid());
        assertEquals(a.idempotencyKey(), b.idempotencyKey());
        assertNotEquals(a.eventId(), b.eventId()); // each delivery is its own event, deduped downstream
    }

    @Test
    void rejects_missing_external_id() {
        MirrorPayload p = new MirrorPayload(
                "  ", "REF", "QRIS", new MirrorPayload.Amount("10.00", "IDR"),
                "ACC", "ACC2", "00", null);
        assertThrows(IngestException.class, () -> adapter.normalize(p));
    }

    @Test
    void rejects_missing_amount() {
        MirrorPayload p = new MirrorPayload(
                "EXT", "REF", "TRANSFER", null, "ACC", "ACC2", "00", null);
        assertThrows(IngestException.class, () -> adapter.normalize(p));
    }

    @Test
    void rejects_non_numeric_amount() {
        MirrorPayload p = new MirrorPayload(
                "EXT", "REF", "TRANSFER", new MirrorPayload.Amount("abc", "IDR"),
                "ACC", "ACC2", "00", null);
        assertThrows(IngestException.class, () -> adapter.normalize(p));
    }

    @Test
    void maps_transaction_types_to_channels() {
        assertEquals(Channel.TRANSFER, adapter.normalize(withType("TRANSFER_INTRABANK")).channel());
        assertEquals(Channel.VIRTUAL_ACCOUNT, adapter.normalize(withType("VIRTUAL_ACCOUNT")).channel());
        assertEquals(Channel.OTHER, adapter.normalize(withType("SOMETHING_ELSE")).channel());
    }

    private MirrorPayload withType(String type) {
        return new MirrorPayload("EXT-" + type, "REF", type,
                new MirrorPayload.Amount("1.00", "IDR"), "ACC", "ACC2", "00", null);
    }
}
