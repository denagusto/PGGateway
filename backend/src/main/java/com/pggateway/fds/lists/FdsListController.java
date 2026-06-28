package com.pggateway.fds.lists;

import com.pggateway.audit.AuditService;
import com.pggateway.fds.lists.FdsListEntry.EntityType;
import com.pggateway.fds.lists.FdsListEntry.ListAction;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Confidential FDS lists management (ADMIN/ANALYST only — locked in SecurityConfig). CRUD over the
 * block / warning / allow lists, every mutation written to the audit trail.
 */
@RestController
@RequestMapping("/api/fds/lists")
public class FdsListController {

    private final FdsListStore store;
    private final AuditService audit;

    public FdsListController(FdsListStore store, AuditService audit) {
        this.store = store;
        this.audit = audit;
    }

    @GetMapping
    public List<FdsListEntry> all() {
        return store.all();
    }

    @PostMapping
    public ResponseEntity<?> add(@RequestBody AddRequest req) {
        if (req.value() == null || req.value().isBlank()) {
            return ResponseEntity.badRequest().body(new Err("value wajib diisi"));
        }
        ListAction action;
        EntityType type;
        try {
            action = ListAction.valueOf(req.action());
            type = EntityType.valueOf(req.entityType());
        } catch (IllegalArgumentException | NullPointerException e) {
            return ResponseEntity.badRequest().body(new Err("action/entityType tidak valid"));
        }
        FdsListEntry e = store.add(action, type, req.value(), req.reason());
        audit.append("fds.list.add", action + ":" + type + ":" + e.value(), e.reason());
        return ResponseEntity.ok(e);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> remove(@PathVariable String id) {
        boolean ok = store.removeById(id);
        if (ok) audit.append("fds.list.remove", id, "");
        return ok ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    public record AddRequest(String action, String entityType, String value, String reason) {}
    public record Err(String error) {}
}
