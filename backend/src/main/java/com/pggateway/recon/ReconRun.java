package com.pggateway.recon;

import java.time.Instant;

/**
 * One reconciliation run: a single source reconciled for one settlement cycle. The portal lists
 * these so finance can see, per source, how clean the day settled (match rate) and how much value
 * is still unreconciled (value at risk).
 *
 * @param source            e.g. "QRIS Switching", "BI-FAST", "Acquirer Bank", "Virtual Account"
 * @param cycleDate         settlement cycle (yyyy-MM-dd)
 * @param status            COMPLETED | RUNNING | FAILED
 * @param total             records compared
 * @param matched           auto-matched records
 * @param breakCount        unmatched / exception records
 * @param matchRatePct      matched / total * 100
 * @param valueReconciled   minor units successfully reconciled
 * @param valueAtRisk       minor units sitting in open breaks
 */
public record ReconRun(
        String id,
        String source,
        String cycleDate,
        String status,
        int total,
        int matched,
        int breakCount,
        double matchRatePct,
        long valueReconciledMinor,
        long valueAtRiskMinor,
        Instant startedAt,
        Instant finishedAt
) {}
