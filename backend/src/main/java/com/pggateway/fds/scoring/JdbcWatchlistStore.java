package com.pggateway.fds.scoring;

import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Durable watchlist on CockroachDB ('cockroach' profile). Edits survive restarts. Uses
 * {@link NamedParameterJdbcTemplate} (named binds, no string concatenation), consistent with the
 * event store. Seeds the demo blocked account once if the table is empty.
 */
@Component
@Profile("cockroach")
public class JdbcWatchlistStore implements WatchlistStore {

    private static final String DDL =
            "CREATE TABLE IF NOT EXISTS watchlist (account STRING PRIMARY KEY, added_at TIMESTAMPTZ DEFAULT now())";

    private final NamedParameterJdbcTemplate jdbc;

    public JdbcWatchlistStore(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostConstruct
    void init() {
        jdbc.getJdbcOperations().execute(DDL);
        Integer n = jdbc.getJdbcOperations().queryForObject("SELECT count(*) FROM watchlist", Integer.class);
        if (n != null && n == 0) add("ACC-BLOCK");
    }

    @Override
    public boolean isBlocked(String account) {
        if (account == null) return false;
        Integer n = jdbc.queryForObject("SELECT count(*) FROM watchlist WHERE account = :a",
                new MapSqlParameterSource("a", account), Integer.class);
        return n != null && n > 0;
    }

    @Override
    public boolean add(String account) {
        if (account == null || account.isBlank()) return false;
        int rows = jdbc.update("INSERT INTO watchlist (account) VALUES (:a) ON CONFLICT (account) DO NOTHING",
                new MapSqlParameterSource("a", account));
        return rows > 0;
    }

    @Override
    public boolean remove(String account) {
        int rows = jdbc.update("DELETE FROM watchlist WHERE account = :a",
                new MapSqlParameterSource("a", account));
        return rows > 0;
    }

    @Override
    public List<String> all() {
        return jdbc.getJdbcOperations().queryForList("SELECT account FROM watchlist ORDER BY account", String.class);
    }
}
