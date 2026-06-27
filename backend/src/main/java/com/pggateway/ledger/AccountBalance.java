package com.pggateway.ledger;

/** Projected balance + activity for one account. {@code balanceMinor} is in minor units (scale 2). */
public record AccountBalance(String account, long balanceMinor, int txnCount) {}
