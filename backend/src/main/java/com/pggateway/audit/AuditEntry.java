package com.pggateway.audit;

import java.time.Instant;

/**
 * One audited action. Immutable trail of who did what to which entity — the basis for the
 * compliance/UU PDP audit requirement.
 */
public record AuditEntry(
        String id,
        Instant timestamp,
        String actor,
        String action,   // e.g. "alert.verdict", "rule.update", "key.create", "recon.resolve"
        String target,   // entity id the action applied to
        String detail
) {}
