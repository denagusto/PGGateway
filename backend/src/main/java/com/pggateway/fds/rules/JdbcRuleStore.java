package com.pggateway.fds.rules;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Durable rule store on CockroachDB ('cockroach' profile). Rule edits survive restarts. Uses
 * {@link NamedParameterJdbcTemplate}; an {@code ord} column preserves display order. Seeds the
 * default rules once if the table is empty.
 */
@Component
@Profile("cockroach")
public class JdbcRuleStore implements RuleStore {

    private static final String DDL = """
            CREATE TABLE IF NOT EXISTS rule (
              id STRING PRIMARY KEY, name STRING, report STRING, enabled BOOL,
              score INT8, expression STRING, ord INT8
            )""";
    private static final String COLS = "id, name, report, enabled, score, expression";

    private final NamedParameterJdbcTemplate jdbc;

    public JdbcRuleStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    void init() {
        jdbc.getJdbcOperations().execute(DDL);
        Integer n = jdbc.getJdbcOperations().queryForObject("SELECT count(*) FROM rule", Integer.class);
        if (n != null && n == 0) {
            long ord = 0;
            for (Rule r : RuleStore.defaults()) insert(r, ord++);
        }
    }

    private void insert(Rule r, long ord) {
        jdbc.update("INSERT INTO rule (" + COLS + ", ord) VALUES (:id,:name,:report,:enabled,:score,:expression,:ord)",
                params(r).addValue("ord", ord));
    }

    private MapSqlParameterSource params(Rule r) {
        return new MapSqlParameterSource()
                .addValue("id", r.id()).addValue("name", r.name()).addValue("report", RuleStore.nz(r.report()))
                .addValue("enabled", r.enabled()).addValue("score", r.score()).addValue("expression", r.expression());
    }

    @Override
    public List<Rule> all() {
        return jdbc.getJdbcOperations().query("SELECT " + COLS + " FROM rule ORDER BY ord", this::map);
    }

    @Override
    public Optional<Rule> get(String id) {
        List<Rule> r = jdbc.query("SELECT " + COLS + " FROM rule WHERE id = :id",
                new MapSqlParameterSource("id", id), this::map);
        return r.isEmpty() ? Optional.empty() : Optional.of(r.get(0));
    }

    @Override
    public Rule create(Rule r) {
        Long maxOrd = jdbc.getJdbcOperations().queryForObject("SELECT coalesce(max(ord), -1) FROM rule", Long.class);
        String id = (r.id() == null || r.id().isBlank())
                ? "rule_" + System.currentTimeMillis() : r.id();
        Rule created = new Rule(id, r.name(), RuleStore.nz(r.report()), r.enabled(), r.score(), r.expression());
        insert(created, (maxOrd == null ? -1 : maxOrd) + 1);
        return created;
    }

    @Override
    public Optional<Rule> update(String id, Map<String, Object> patch) {
        Optional<Rule> cur = get(id);
        if (cur.isEmpty()) return Optional.empty();
        Rule updated = RuleStore.merge(cur.get(), patch);
        jdbc.update("UPDATE rule SET name=:name, report=:report, enabled=:enabled, score=:score, expression=:expression WHERE id=:id",
                params(updated));
        return Optional.of(updated);
    }

    @Override
    public boolean delete(String id) {
        return jdbc.update("DELETE FROM rule WHERE id = :id", new MapSqlParameterSource("id", id)) > 0;
    }

    private Rule map(ResultSet rs, int rowNum) throws SQLException {
        return new Rule(rs.getString("id"), rs.getString("name"), rs.getString("report"),
                rs.getBoolean("enabled"), rs.getInt("score"), rs.getString("expression"));
    }
}
