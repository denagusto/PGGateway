package com.pggateway.eventstore;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;

/**
 * Durable, CockroachDB-backed event store (distributed SQL). Active only under the 'cockroach'
 * profile — the default profile uses {@link InMemoryEventStore}, so the app still runs with no
 * database.
 *
 * Idempotency is enforced by a UNIQUE constraint on idempotency_key; per-partition sequence is
 * computed in a serializable transaction (CockroachDB SERIALIZABLE makes MAX+1 safe). Events
 * survive restarts and are sharded/replicated across the cluster nodes.
 */
@Component
@Profile("cockroach")
public class JdbcEventStore implements EventStore {

    private static final String DDL = """
            CREATE TABLE IF NOT EXISTS canonical_event (
              id STRING PRIMARY KEY,
              idempotency_key STRING UNIQUE NOT NULL,
              txn_ref STRING, channel STRING, amount_minor INT8, currency STRING,
              occurred_at TIMESTAMPTZ, source_party STRING, dest_party STRING, status STRING,
              partition_key STRING, upstream_seq INT8, raw_payload_ref STRING,
              partition_seq INT8, created_at TIMESTAMPTZ DEFAULT now()
            )""";

    private final JdbcTemplate jdbc;

    public JdbcEventStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    void init() {
        jdbc.execute(DDL);
    }

    @Override
    @Transactional
    public AppendResult append(CanonicalEvent e) {
        Integer exists = jdbc.queryForObject(
                "SELECT count(*) FROM canonical_event WHERE idempotency_key = ?",
                Integer.class, e.idempotencyKey());
        if (exists != null && exists > 0) {
            Long seq = jdbc.queryForObject(
                    "SELECT partition_seq FROM canonical_event WHERE idempotency_key = ?",
                    Long.class, e.idempotencyKey());
            return new AppendResult(AppendOutcome.DUPLICATE, seq == null ? 0 : seq, List.of());
        }
        Long maxSeq = jdbc.queryForObject(
                "SELECT coalesce(max(partition_seq), 0) FROM canonical_event WHERE partition_key = ?",
                Long.class, e.partitionKey());
        long seq = (maxSeq == null ? 0 : maxSeq) + 1;
        jdbc.update("""
                INSERT INTO canonical_event
                  (id, idempotency_key, txn_ref, channel, amount_minor, currency, occurred_at,
                   source_party, dest_party, status, partition_key, upstream_seq, raw_payload_ref, partition_seq)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                e.eventId(), e.idempotencyKey(), e.txnRef(), e.channel().name(), e.amountMinor(),
                e.currency(), e.occurredAt() == null ? null : Timestamp.from(e.occurredAt()),
                e.sourceParty(), e.destParty(), e.status(), e.partitionKey(), e.upstreamSeq(),
                e.rawPayloadRef(), seq);
        // gap-detection against upstreamSeq is deferred for the JDBC store (computed by the
        // in-memory store today); ordering + dedup + durability are in place.
        return new AppendResult(AppendOutcome.APPENDED, seq, List.of());
    }

    @Override
    public List<CanonicalEvent> recent(int limit) {
        return jdbc.query(
                "SELECT * FROM canonical_event ORDER BY created_at DESC, partition_seq DESC LIMIT ?",
                this::map, limit);
    }

    @Override
    public int size() {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM canonical_event", Integer.class);
        return n == null ? 0 : n;
    }

    private CanonicalEvent map(ResultSet rs, int rowNum) throws SQLException {
        Timestamp occurred = rs.getTimestamp("occurred_at");
        Object up = rs.getObject("upstream_seq");
        return new CanonicalEvent(
                rs.getString("id"), rs.getString("idempotency_key"), rs.getString("txn_ref"),
                Channel.valueOf(rs.getString("channel")), rs.getLong("amount_minor"),
                rs.getString("currency"), occurred == null ? null : occurred.toInstant(),
                rs.getString("source_party"), rs.getString("dest_party"), rs.getString("status"),
                rs.getString("partition_key"), up == null ? null : ((Number) up).longValue(),
                rs.getString("raw_payload_ref"));
    }
}
