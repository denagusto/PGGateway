package com.pggateway.fds.ai;

import java.util.List;

/**
 * One fraud/AML typology in the {@link TypologyLibrary} — a retrievable knowledge unit.
 *
 * @param id                 stable slug
 * @param code               short label (LTKM / MULE / DTTOT …)
 * @param name               human name
 * @param category           AML | Fraud
 * @param description        what the scheme is
 * @param indicators         terms / signal cues that surface it (the retrieval keys)
 * @param regulatoryMapping  the report/obligation it maps to
 * @param recommendedAction  what the analyst should do
 */
public record Typology(
        String id,
        String code,
        String name,
        String category,
        String description,
        List<String> indicators,
        String regulatoryMapping,
        String recommendedAction
) {}
