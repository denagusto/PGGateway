package com.pggateway.fds;

import com.pggateway.ingest.Channel;

import java.time.Instant;
import java.util.List;

/**
 * A fraud / AML alert raised by a rule for one transaction.
 *
 * @param rule     the rule id that fired (e.g. "structuring")
 * @param ruleName human label of that rule (denormalized for the UI)
 * @param report   PPATK report this maps to ("LTKM" or "LTKT") — guidance for the compliance
 *                 officer; the system flags, a human decides whether to file.
 */
public record Alert(
        String alertId,
        String tenantId,      // owning PJP — copied from the triggering event
        String txnEventId,
        String txnRef,
        String account,
        Channel channel,
        long amountMinor,
        int score,
        String rule,
        String ruleName,
        String report,
        List<String> reasons,
        AlertStatus status,
        Instant createdAt
) {
    public Alert withStatus(AlertStatus newStatus) {
        return new Alert(alertId, tenantId, txnEventId, txnRef, account, channel, amountMinor,
                score, rule, ruleName, report, reasons, newStatus, createdAt);
    }
}
