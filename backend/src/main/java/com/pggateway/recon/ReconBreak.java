package com.pggateway.recon;

import java.time.Instant;

/**
 * A reconciliation break (exception) — one record that did not cleanly match between the ledger and
 * a settlement source, carrying the full exception-management workflow state.
 *
 * @param category  UNSETTLED | UNEXPECTED | AMOUNT_MISMATCH | DUPLICATE | LATE_SETTLEMENT | STATUS_MISMATCH
 * @param status    OPEN | INVESTIGATING | RESOLVED | WRITTEN_OFF
 * @param amountLedgerMinor  ledger side (null = absent)
 * @param amountSourceMinor  settlement-source side (null = absent)
 * @param diffMinor          signed difference (null when one side absent)
 * @param assignee  analyst owning the break ("" = unassigned)
 * @param ageHours  hours the break has been open (drives aging buckets / SLA)
 * @param note      investigation note / resolution rationale
 */
public record ReconBreak(
        String id,
        String runId,
        String source,
        String txnRef,
        String category,
        Long amountLedgerMinor,
        Long amountSourceMinor,
        Long diffMinor,
        String status,
        String assignee,
        int ageHours,
        String note,
        Instant createdAt
) {
    public ReconBreak with(String newStatus, String newAssignee, String newNote) {
        return new ReconBreak(id, runId, source, txnRef, category, amountLedgerMinor, amountSourceMinor,
                diffMinor, newStatus == null ? status : newStatus,
                newAssignee == null ? assignee : newAssignee,
                ageHours, newNote == null ? note : newNote, createdAt);
    }
}
