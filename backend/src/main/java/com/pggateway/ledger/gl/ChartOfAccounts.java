package com.pggateway.ledger.gl;

import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The chart of accounts for a payment-service-provider (PJP) book. Control accounts are fixed;
 * per-merchant payable sub-accounts are created on demand under control account 2000.
 *
 * The acquiring posting model: when the gateway captures a payment it holds the funds in a
 * settlement-clearing ASSET, owes the merchant the net (a LIABILITY), and recognizes the fee as
 * REVENUE. Customer-float and bank (nostro) accounts round out the fund-safeguarding picture.
 */
@Component
public class ChartOfAccounts {

    public static final String SETTLEMENT_CLEARING = "1000";
    public static final String BANK_NOSTRO = "1100";
    public static final String MERCHANT_PAYABLE = "2000";
    public static final String CUSTOMER_FLOAT = "2100";
    public static final String FEE_REVENUE = "4000";

    private final Map<String, Account> accounts = new LinkedHashMap<>();

    public ChartOfAccounts() {
        put(new Account(SETTLEMENT_CLEARING, "Kas Settlement (clearing)", AccountType.ASSET, null));
        put(new Account(BANK_NOSTRO, "Rekening Bank (nostro)", AccountType.ASSET, null));
        put(new Account(MERCHANT_PAYABLE, "Utang ke Merchant", AccountType.LIABILITY, null));
        put(new Account(CUSTOMER_FLOAT, "Dana Nasabah (escrow)", AccountType.LIABILITY, null));
        put(new Account(FEE_REVENUE, "Pendapatan Biaya", AccountType.REVENUE, null));
    }

    private void put(Account a) {
        accounts.put(a.code(), a);
    }

    public Account get(String code) {
        return accounts.get(code);
    }

    /** The per-merchant payable sub-account under control account 2000 (registers it if new). */
    public Account merchantPayable(String merchant) {
        String code = MERCHANT_PAYABLE + ":" + merchant;
        return accounts.computeIfAbsent(code,
                c -> new Account(c, "Utang Merchant — " + merchant, AccountType.LIABILITY, MERCHANT_PAYABLE));
    }

    /** All control accounts (fixed), in display order. */
    public List<Account> controlAccounts() {
        return accounts.values().stream().filter(a -> !a.isSubAccount()).toList();
    }
}
