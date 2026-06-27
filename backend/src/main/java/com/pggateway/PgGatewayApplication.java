package com.pggateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * PGGateway backend — T1: ingest core.
 *
 * Pipeline (this slice):
 *   SNAP mirror callback -> MirrorIngestAdapter -> CanonicalEvent -> EventStore (append-only)
 *
 * Downstream (later tasks): partitioned ledger projection, FDS consumer-group, reconciliation.
 */
@SpringBootApplication
public class PgGatewayApplication {
    public static void main(String[] args) {
        SpringApplication.run(PgGatewayApplication.class, args);
    }
}
