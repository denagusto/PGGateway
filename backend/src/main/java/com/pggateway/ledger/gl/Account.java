package com.pggateway.ledger.gl;

/**
 * A chart-of-accounts entry. {@code code} is the stable account number (e.g. "2000" or, for a
 * per-merchant sub-account, "2000:ACC-merchant"); {@code parentCode} links a sub-account to its
 * control account so the general ledger can roll sub-accounts up.
 */
public record Account(String code, String name, AccountType type, String parentCode) {
    public boolean isSubAccount() {
        return parentCode != null && !parentCode.isBlank();
    }
}
