package com.pggateway.ledger;

/** Projected balance + activity for one account of one tenant (PJP). {@code balanceMinor} is minor units (scale 2). */
public record AccountBalance(String tenantId, String account, long balanceMinor, int txnCount) {}
