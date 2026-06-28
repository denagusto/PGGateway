package com.pggateway.fds.lists;

import java.time.Instant;

/**
 * One entry in the FDS lists. The action decides how the engine reacts to a match, the entity type
 * decides what kind of identifier {@code value} is (account, card BIN, device, IP, country), and
 * {@code reason} is the compliance note that justifies the entry.
 */
public record FdsListEntry(
        String id,
        ListAction action,
        EntityType entityType,
        String value,
        String reason,
        Instant createdAt
) {
    public enum ListAction {
        /** Strong fraud signal — known mule / sanctioned / DTTOT. */
        BLOCK,
        /** Elevated suspicion — watch, don't necessarily block. */
        WARNING,
        /** Trusted — known-good, suppresses noise (allowlist). */
        ALLOW
    }

    public enum EntityType { ACCOUNT, BIN, DEVICE, IP, COUNTRY }
}
