package com.pggateway.fds.scoring;

import com.pggateway.audit.AuditService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * CRUD for the dynamic watchlist / blocklist — the FDS config screen talks to this. A compliance
 * officer adds/removes blocked accounts (mules, sanctioned parties, DTTOT) at runtime; the
 * {@link com.pggateway.fds.scoring.detectors.WatchlistDetector} reacts on the next transaction.
 */
@RestController
@RequestMapping("/api/fds/watchlist")
public class WatchlistController {

    private final WatchlistStore store;
    private final AuditService audit;

    public WatchlistController(WatchlistStore store, AuditService audit) {
        this.store = store;
        this.audit = audit;
    }

    @GetMapping
    public List<String> all() {
        return store.all();
    }

    public record AddRequest(String account) {}

    @PostMapping
    public ResponseEntity<?> add(@RequestBody AddRequest req) {
        String account = req.account() == null ? "" : req.account().trim();
        if (account.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "akun wajib diisi"));
        }
        boolean added = store.add(account);
        if (added) audit.append("watchlist.add", account, "");
        return ResponseEntity.ok(Map.of("account", account, "added", added));
    }

    @DeleteMapping("/{account}")
    public ResponseEntity<Void> remove(@PathVariable String account) {
        boolean removed = store.remove(account);
        if (removed) audit.append("watchlist.remove", account, "");
        return removed ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }
}
