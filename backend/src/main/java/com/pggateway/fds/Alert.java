package com.pggateway.fds;

import com.pggateway.ingest.Channel;

import java.time.Instant;
import java.util.List;

/**
 * A fraud / AML alert (a "case") raised for one transaction by the risk-scoring engine.
 *
 * @param score    composite 0–100 risk score fused from all detector signals
 * @param band     risk tier derived from the score: LOW / MEDIUM / HIGH / CRITICAL
 * @param rule     the strongest contributing signal's code (headline + dedup key)
 * @param ruleName human label of that signal (denormalized for the UI)
 * @param report   PPATK report this maps to ("LTKM" or "LTKT") — guidance for the compliance
 *                 officer; the system flags, a human decides whether to file.
 * @param reasons  every contributing signal, explained — the audit trail for the decision.
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
        String band,
        String rule,
        String ruleName,
        String report,
        List<String> reasons,
        AlertStatus status,
        Instant createdAt
) {
    public Alert withStatus(AlertStatus newStatus) {
        return new Alert(alertId, tenantId, txnEventId, txnRef, account, channel, amountMinor,
                score, band, rule, ruleName, report, reasons, newStatus, createdAt);
    }
}
