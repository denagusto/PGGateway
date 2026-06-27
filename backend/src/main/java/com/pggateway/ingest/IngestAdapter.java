package com.pggateway.ingest;

/**
 * SPI for an ingest mode. Each mode (mirror, CDC, Kafka tap, inline) implements this and is
 * the ONLY component that understands its raw payload shape. Output is always a
 * {@link CanonicalEvent}, so the rest of the system stays mode-agnostic.
 *
 * @param <R> the raw inbound payload type for this mode
 */
public interface IngestAdapter<R> {

    /** Short id of this ingest mode, e.g. "mirror". */
    String source();

    /**
     * Normalize a raw payload into the canonical event.
     *
     * @throws IngestException if the payload is missing required fields or malformed
     */
    CanonicalEvent normalize(R raw);
}
