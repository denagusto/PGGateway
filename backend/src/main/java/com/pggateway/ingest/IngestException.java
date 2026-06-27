package com.pggateway.ingest;

/** Thrown when a raw payload cannot be normalized into a {@link CanonicalEvent}. */
public class IngestException extends RuntimeException {
    public IngestException(String message) {
        super(message);
    }
}
