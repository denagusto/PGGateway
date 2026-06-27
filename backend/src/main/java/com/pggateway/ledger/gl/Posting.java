package com.pggateway.ledger.gl;

/**
 * One leg of a journal entry: an amount posted to the debit or credit side of an account.
 * Amounts are positive minor units; {@code debit} chooses the side.
 */
public record Posting(
        String accountCode,
        String accountName,
        AccountType type,
        boolean debit,
        long amountMinor
) {
    public static Posting debit(Account a, long amountMinor) {
        return new Posting(a.code(), a.name(), a.type(), true, amountMinor);
    }

    public static Posting credit(Account a, long amountMinor) {
        return new Posting(a.code(), a.name(), a.type(), false, amountMinor);
    }
}
