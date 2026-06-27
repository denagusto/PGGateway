package com.pggateway.ledger.gl;

import java.time.Instant;
import java.util.List;

/**
 * A journal entry — the first tier of the ledger. An immutable, balanced set of postings for one
 * business event: the sum of debits MUST equal the sum of credits (enforced at construction).
 */
public record JournalEntry(
        String id,
        String tenantId,
        String txnRef,
        Instant occurredAt,
        String description,
        List<Posting> postings
) {
    public JournalEntry {
        long debits = postings.stream().filter(Posting::debit).mapToLong(Posting::amountMinor).sum();
        long credits = postings.stream().filter(p -> !p.debit()).mapToLong(Posting::amountMinor).sum();
        if (debits != credits) {
            throw new IllegalArgumentException(
                    "journal entry not balanced: debit " + debits + " != credit " + credits);
        }
    }

    public long totalDebitMinor() {
        return postings.stream().filter(Posting::debit).mapToLong(Posting::amountMinor).sum();
    }
}
