package com.pggateway.fds.scoring;

import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dynamic blocklist of accounts (mules, sanctioned parties, known fraud). Editable at runtime —
 * a compliance officer adds/removes entries without a redeploy, the way a bank maintains its
 * watchlist / sanctions screening list. In-memory now; later CockroachDB + an upstream sanctions
 * feed (OFAC/UN/Bank Indonesia DTTOT).
 */
@Component
public class WatchlistStore {

    private final Set<String> blocked = ConcurrentHashMap.newKeySet();

    public WatchlistStore() {
        blocked.add("ACC-BLOCK"); // demo seed so the watchlist layer is observable
    }

    public boolean isBlocked(String account) {
        return account != null && blocked.contains(account);
    }

    public boolean add(String account) {
        return account != null && !account.isBlank() && blocked.add(account);
    }

    public boolean remove(String account) {
        return blocked.remove(account);
    }

    public List<String> all() {
        return List.copyOf(blocked);
    }
}
