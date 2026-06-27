package com.pggateway.ingest.mirror;

/**
 * SNAP-flavored mirror callback payload. The PJP forwards a COPY of each transaction here
 * (sidecar, read-only — not in the critical path). Field names follow SNAP conventions.
 *
 * NOTE: no PAN / card number field — card data must be tokenized/dropped before it reaches us.
 */
public record MirrorPayload(
        String externalId,            // SNAP X-EXTERNAL-ID → idempotency key
        String partnerReferenceNo,    // → txnRef
        String transactionType,       // e.g. QRIS_MPM, TRANSFER_INTRABANK, VIRTUAL_ACCOUNT
        Amount amount,                // { value, currency }
        String sourceAccountNo,       // → partition key + source party
        String beneficiaryAccountNo,  // → destination party
        String latestTransactionStatus,
        Long seq                      // optional upstream per-partition sequence (gap-detection)
) {
    public record Amount(String value, String currency) {}
}
