package com.pggateway.eventstore;

import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.Channel;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;

/**
 * Durable, CockroachDB-backed event store (distributed SQL). Active only under the 'cockroach'
 * profile — the default profile uses {@link InMemoryEventStore}, so the app still runs with no
 * database.
 *
 * Query execution uses {@link NamedParameterJdbcTemplate} (parameters bound by name, never string
 * concatenation — so it is SQL-injection-safe and readable with 15 columns), with explicit column
 * lists (no {@code SELECT *}, so the row mapper can't silently break when the schema grows).
 *
 * Append is a SINGLE atomic statement rather than check-then-act:
 * <pre>
 *   INSERT ... VALUES (..., (SELECT max(partition_seq)+1 WHERE partition_key = :pk))
 *   ON CONFLICT (idempotency_key) DO NOTHING
 *   RETURNING partition_seq
 * </pre>
 * Idempotency is the UNIQUE constraint doing the work (no racy "SELECT count then INSERT"), and the
 * per-partition sequence is derived inside the same statement. Because it is one statement it runs
 * as an implicit transaction, which CockroachDB auto-retries on a serialization conflict — so two
 * concurrent appends to the same partition get distinct, monotonic sequence numbers without an
 * explicit @Transactional retry loop. A returned row means APPENDED; no row means the key already
 * existed (DUPLICATE), and we read back its sequence.
 */
@Component
@Profile("cockroach")
public class JdbcEventStore implements EventStore {

    private static final String DDL = """
            CREATE TABLE IF NOT EXISTS canonical_event (
              id STRING PRIMARY KEY,
              tenant_id STRING,
              idempotency_key STRING UNIQUE NOT NULL,
              txn_ref STRING, channel STRING, amount_minor INT8, currency STRING,
              occurred_at TIMESTAMPTZ, source_party STRING, dest_party STRING, status STRING,
              partition_key STRING, upstream_seq INT8, raw_payload_ref STRING,
              partition_seq INT8, created_at TIMESTAMPTZ DEFAULT now(),
              INDEX (tenant_id)
            )""";

    private static final String COLS =
            "id, tenant_id, idempotency_key, txn_ref, channel, amount_minor, currency, occurred_at, "
            + "source_party, dest_party, status, partition_key, upstream_seq, raw_payload_ref, partition_seq";

    private static final String INSERT_RETURNING = """
            INSERT INTO canonical_event
              (id, tenant_id, idempotency_key, txn_ref, channel, amount_minor, currency, occurred_at,
               source_party, dest_party, status, partition_key, upstream_seq, raw_payload_ref, partition_seq)
            VALUES
              (:id, :tenantId, :idempotencyKey, :txnRef, :channel, :amountMinor, :currency, :occurredAt,
               :sourceParty, :destParty, :status, :partitionKey, :upstreamSeq, :rawPayloadRef,
               (SELECT coalesce(max(partition_seq), 0) + 1 FROM canonical_event WHERE partition_key = :partitionKey))
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING partition_seq""";

    private final NamedParameterJdbcTemplate jdbc;

    public JdbcEventStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    void init() {
        jdbc.getJdbcOperations().execute(DDL);
    }

    @Override
    public AppendResult append(CanonicalEvent e) {
        MapSqlParameterSource p = new MapSqlParameterSource()
                .addValue("id", e.eventId())
                .addValue("tenantId", e.tenantId())
                .addValue("idempotencyKey", e.idempotencyKey())
                .addValue("txnRef", e.txnRef())
                .addValue("channel", e.channel().name())
                .addValue("amountMinor", e.amountMinor())
                .addValue("currency", e.currency())
                .addValue("occurredAt", e.occurredAt() == null ? null : Timestamp.from(e.occurredAt()))
                .addValue("sourceParty", e.sourceParty())
                .addValue("destParty", e.destParty())
                .addValue("status", e.status())
                .addValue("partitionKey", e.partitionKey())
                .addValue("upstreamSeq", e.upstreamSeq())
                .addValue("rawPayloadRef", e.rawPayloadRef());

        // RETURNING gives back the assigned partition_seq for an actual insert; empty on conflict.
        List<Long> assigned = jdbc.queryForList(INSERT_RETURNING, p, Long.class);
        if (!assigned.isEmpty()) {
            // gap-detection against upstreamSeq is deferred for the JDBC store (computed by the
            // in-memory store today); ordering + dedup + durability are in place.
            return new AppendResult(AppendOutcome.APPENDED, assigned.get(0), List.of());
        }
        Long existing = jdbc.queryForObject(
                "SELECT partition_seq FROM canonical_event WHERE idempotency_key = :idempotencyKey",
                new MapSqlParameterSource("idempotencyKey", e.idempotencyKey()), Long.class);
        return new AppendResult(AppendOutcome.DUPLICATE, existing == null ? 0 : existing, List.of());
    }

    @Override
    public List<CanonicalEvent> recent(int limit, String tenantId) {
        MapSqlParameterSource p = new MapSqlParameterSource().addValue("limit", limit);
        String where = "";
        if (tenantId != null) {
            where = " WHERE tenant_id = :tenantId";
            p.addValue("tenantId", tenantId);
        }
        return jdbc.query(
                "SELECT " + COLS + " FROM canonical_event" + where
                        + " ORDER BY created_at DESC, partition_seq DESC LIMIT :limit",
                p, this::map);
    }

    @Override
    public int size(String tenantId) {
        String sql = tenantId == null
                ? "SELECT count(*) FROM canonical_event"
                : "SELECT count(*) FROM canonical_event WHERE tenant_id = :tenantId";
        Integer n = jdbc.queryForObject(sql,
                new MapSqlParameterSource("tenantId", tenantId), Integer.class);
        return n == null ? 0 : n;
    }

    private CanonicalEvent map(ResultSet rs, int rowNum) throws SQLException {
        Timestamp occurred = rs.getTimestamp("occurred_at");
        Object up = rs.getObject("upstream_seq");
        return new CanonicalEvent(
                rs.getString("id"), rs.getString("tenant_id"), rs.getString("idempotency_key"),
                rs.getString("txn_ref"), Channel.valueOf(rs.getString("channel")), rs.getLong("amount_minor"),
                rs.getString("currency"), occurred == null ? null : occurred.toInstant(),
                rs.getString("source_party"), rs.getString("dest_party"), rs.getString("status"),
                rs.getString("partition_key"), up == null ? null : ((Number) up).longValue(),
                rs.getString("raw_payload_ref"));
    }
}
