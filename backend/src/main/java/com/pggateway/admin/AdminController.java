package com.pggateway.admin;

import com.pggateway.audit.AuditService;
import com.pggateway.auth.AuthPrincipal;
import com.pggateway.auth.JwtService;
import com.pggateway.auth.UserStore;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Platform super-admin API (ADMIN role only — enforced in SecurityConfig). What the super-admin can
 * do: onboard / suspend PJP tenants, create dashboard users, and "login as" (impersonate) a tenant
 * for support. Every action is audited.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    private final TenantStore tenants;
    private final UserStore users;
    private final JwtService jwt;
    private final AuditService audit;

    public AdminController(TenantStore tenants, UserStore users, JwtService jwt, AuditService audit) {
        this.tenants = tenants;
        this.users = users;
        this.jwt = jwt;
        this.audit = audit;
    }

    // ---- Tenants ----
    @GetMapping("/tenants")
    public List<TenantStore.Tenant> tenants() {
        return tenants.all();
    }

    public record RegisterTenant(String id, String name, String env) {}

    @PostMapping("/tenants")
    public ResponseEntity<?> register(@RequestBody RegisterTenant req) {
        if (req.id() == null || req.id().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "id tenant wajib diisi"));
        }
        TenantStore.Tenant t = tenants.register(req.id(), req.name(), req.env(), Instant.now());
        audit.append("tenant.register", t.id(), t.name() + " (" + t.env() + ")");
        return ResponseEntity.ok(t);
    }

    public record StatusReq(String status) {}

    @PostMapping("/tenants/{id}/status")
    public ResponseEntity<?> setStatus(@PathVariable String id, @RequestBody StatusReq req) {
        return tenants.setStatus(id, req.status())
                .map(t -> { audit.append("tenant.status", id, req.status()); return ResponseEntity.ok((Object) t); })
                .orElse(ResponseEntity.notFound().build());
    }

    // ---- Users ----
    @GetMapping("/users")
    public List<AuthPrincipal> users() {
        return users.list();
    }

    public record CreateUser(String username, String password, String displayName, String role, String tenant) {}

    @PostMapping("/users")
    public ResponseEntity<?> createUser(@RequestBody CreateUser req) {
        if (req.username() == null || req.username().isBlank() || req.password() == null || req.password().length() < 4) {
            return ResponseEntity.badRequest().body(Map.of("error", "username wajib, password minimal 4 karakter"));
        }
        if (users.exists(req.username())) {
            return ResponseEntity.badRequest().body(Map.of("error", "username sudah dipakai"));
        }
        String role = req.role() == null ? "PJP" : req.role().toUpperCase();
        if (role.equals("PJP") && (req.tenant() == null || !tenants.exists(req.tenant()))) {
            return ResponseEntity.badRequest().body(Map.of("error", "user PJP butuh tenant yang valid"));
        }
        AuthPrincipal who = users.create(req.username(), req.password(), req.displayName(), role,
                role.equals("PJP") ? req.tenant() : null);
        audit.append("user.create", who.username(), role + (who.tenantId() == null ? "" : " · " + who.tenantId()));
        return ResponseEntity.ok(who);
    }

    // ---- Impersonation (login as) ----
    public record ImpersonateReq(String tenantId) {}

    @PostMapping("/impersonate")
    public ResponseEntity<?> impersonate(@RequestBody ImpersonateReq req,
                                         @AuthenticationPrincipal AuthPrincipal admin) {
        if (req.tenantId() == null || !tenants.exists(req.tenantId())) {
            return ResponseEntity.badRequest().body(Map.of("error", "tenant tidak ditemukan"));
        }
        AuthPrincipal as = new AuthPrincipal(
                admin.username(), "Impersonasi · " + req.tenantId(), "PJP", req.tenantId());
        audit.append("admin.impersonate", req.tenantId(), "oleh " + admin.username());
        return ResponseEntity.ok(Map.of("token", jwt.issue(as), "user", as));
    }
}
