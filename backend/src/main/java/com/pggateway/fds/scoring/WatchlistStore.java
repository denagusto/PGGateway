package com.pggateway.fds.scoring;

import java.util.List;

/**
 * Dynamic blocklist of accounts (mules, sanctioned parties, DTTOT). Editable at runtime — a
 * compliance officer adds/removes entries without a redeploy. Two implementations swap by profile:
 * an in-memory stand-in (default) and a durable CockroachDB store (the 'cockroach' profile), so
 * watchlist edits survive a restart.
 */
public interface WatchlistStore {

    boolean isBlocked(String account);

    boolean add(String account);

    boolean remove(String account);

    List<String> all();
}
