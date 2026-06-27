package com.pggateway.ledger.gl;

/**
 * The five classes of a double-entry chart of accounts, each with its normal balance side.
 * Normal side decides whether a positive balance is shown in the debit or credit column and how
 * the account rolls up into the trial balance and the balance sheet.
 */
public enum AccountType {
    ASSET(Normal.DEBIT),
    LIABILITY(Normal.CREDIT),
    EQUITY(Normal.CREDIT),
    REVENUE(Normal.CREDIT),
    EXPENSE(Normal.DEBIT);

    public enum Normal { DEBIT, CREDIT }

    private final Normal normal;

    AccountType(Normal normal) {
        this.normal = normal;
    }

    public Normal normal() {
        return normal;
    }
}
