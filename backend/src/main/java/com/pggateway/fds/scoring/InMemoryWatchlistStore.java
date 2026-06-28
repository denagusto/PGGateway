package com.pggateway.fds.scoring;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory watchlist (default profile). Seeded with a demo blocked account. */
@Component
@Profile("!cockroach")
public class InMemoryWatchlistStore implements WatchlistStore {

    private final Set<String> blocked = ConcurrentHashMap.newKeySet();

    public InMemoryWatchlistStore() {
        blocked.add("ACC-BLOCK"); // demo seed so the watchlist layer is observable
    }

    @Override
    public boolean isBlocked(String account) {
        return account != null && blocked.contains(account);
    }

    @Override
    public boolean add(String account) {
        return account != null && !account.isBlank() && blocked.add(account);
    }

    @Override
    public boolean remove(String account) {
        return blocked.remove(account);
    }

    @Override
    public List<String> all() {
        return List.copyOf(blocked);
    }
}
