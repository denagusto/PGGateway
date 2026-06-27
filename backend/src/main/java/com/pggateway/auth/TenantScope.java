package com.pggateway.auth;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Derives the tenant a request is allowed to see FROM THE AUTHENTICATED SESSION — closing the gap
 * where {@code ?tenant=} was trusted from the client. A tenant-locked user (PJP) is always forced
 * to their own tenant, no matter what they pass; a platform-wide user (admin/analyst) may scope to
 * any tenant (or all, when none is given).
 */
@Component
public class TenantScope {

    /** The effective tenant for a read; null = all tenants (platform-wide users only). */
    public String resolve(String requested) {
        AuthPrincipal user = current();
        if (user != null && !user.isPlatformWide()) {
            return user.tenantId(); // locked — ignore whatever the client asked for
        }
        return (requested == null || requested.isBlank() || "all".equalsIgnoreCase(requested)) ? null : requested;
    }

    /** Tenants the current user may choose from (for the scope selector). */
    public List<String> allowedTenants(List<String> allTenants) {
        AuthPrincipal user = current();
        if (user != null && !user.isPlatformWide()) return List.of(user.tenantId());
        return allTenants;
    }

    public AuthPrincipal current() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof AuthPrincipal p) return p;
        return null;
    }
}
