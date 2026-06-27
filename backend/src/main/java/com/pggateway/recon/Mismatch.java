package com.pggateway.recon;

/**
 * A reconciliation discrepancy between the PGGateway ledger (PJP side) and the counterparty/
 * settlement feed.
 *
 * @param type "selisih_nominal" (both sides present, amounts differ) or "satu_sisi" (present on
 *             only one side). Amounts are minor units (scale 2); a null side means "absent".
 */
public record Mismatch(
        String id,
        String txnRef,
        Long amountPjpMinor,
        Long amountCounterpartyMinor,
        Long diffMinor,
        String type,
        boolean resolved
) {}
