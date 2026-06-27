package com.pggateway.ingest.mirror;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import com.pggateway.ingest.IngestAdapter;
import com.pggateway.ingest.IngestException;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Normalizes a SNAP mirror callback into a {@link CanonicalEvent}. First of the 4 ingest modes. */
@Component
public class MirrorIngestAdapter implements IngestAdapter<MirrorPayload> {

    @Override
    public String source() {
        return "mirror";
    }

    @Override
    public CanonicalEvent normalize(MirrorPayload p) {
        require(p != null, "payload");
        require(notBlank(p.externalId()), "externalId");
        require(notBlank(p.partnerReferenceNo()), "partnerReferenceNo");
        require(p.amount() != null && notBlank(p.amount().value()), "amount.value");
        require(notBlank(p.sourceAccountNo()), "sourceAccountNo");

        long amountMinor = parseMinor(p.amount().value());
        String currency = notBlank(p.amount().currency()) ? p.amount().currency() : "IDR";

        return new CanonicalEvent(
                UUID.randomUUID().toString(),
                "PJP-DEMO",                     // default tenant; the ingest boundary overrides via withTenant()
                p.externalId(),                 // idempotency key
                p.partnerReferenceNo(),         // txnRef
                Channel.fromTransactionType(p.transactionType()),
                amountMinor,
                currency,
                Instant.now(),
                p.sourceAccountNo(),            // source party
                p.beneficiaryAccountNo(),       // dest party
                notBlank(p.latestTransactionStatus()) ? p.latestTransactionStatus() : "UNKNOWN",
                p.sourceAccountNo(),            // partition key → shard-per-account
                p.seq(),                        // upstream seq (optional) → gap-detection
                "mirror:" + p.externalId()      // raw payload ref placeholder; never holds PAN
        );
    }

    /** "75000.00" -> 7500000 (minor units, scale 2). Exact; rejects non-numeric. */
    private static long parseMinor(String value) {
        try {
            return new BigDecimal(value).movePointRight(2).longValueExact();
        } catch (ArithmeticException | NumberFormatException e) {
            throw new IngestException("amount.value is not a valid amount: " + value);
        }
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }

    private static void require(boolean cond, String field) {
        if (!cond) throw new IngestException("missing or invalid field: " + field);
    }
}
