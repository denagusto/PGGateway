package com.pggateway.ingest;

/** Payment channel a transaction arrived on (normalized across SNAP transaction types). */
public enum Channel {
    QRIS,
    TRANSFER,
    VIRTUAL_ACCOUNT,
    DIRECT_DEBIT,
    OTHER;

    /** Map a SNAP-ish transactionType string to a canonical channel. */
    public static Channel fromTransactionType(String t) {
        if (t == null) return OTHER;
        String s = t.trim().toUpperCase();
        if (s.startsWith("QRIS")) return QRIS;
        if (s.startsWith("TRANSFER")) return TRANSFER;
        if (s.startsWith("VIRTUAL_ACCOUNT") || s.equals("VA")) return VIRTUAL_ACCOUNT;
        if (s.startsWith("DIRECT_DEBIT") || s.startsWith("DEBIT")) return DIRECT_DEBIT;
        return OTHER;
    }
}
