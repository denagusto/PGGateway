package com.pggateway.fds;

import com.pggateway.ingest.Channel;

import java.time.Instant;
import java.util.List;

/** A fraud alert raised by a detector for one transaction. */
public record Alert(
        String alertId,
        String txnEventId,
        String txnRef,
        String account,
        Channel channel,
        long amountMinor,
        int score,
        String rule,
        List<String> reasons,
        AlertStatus status,
        Instant createdAt
) {
    /** Copy with a new status (records are immutable). */
    public Alert withStatus(AlertStatus newStatus) {
        return new Alert(alertId, txnEventId, txnRef, account, channel, amountMinor,
                score, rule, reasons, newStatus, createdAt);
    }
}
