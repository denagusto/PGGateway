package com.pggateway.auth;

/**
 * The authenticated user attached to each request. {@code tenantId} null means a platform-wide
 * user (admin/analyst) who may scope to any PJP; a non-null tenant locks the user to that PJP —
 * this is what makes tenant scope derive from the session, not a client-supplied parameter.
 */
public record AuthPrincipal(String username, String displayName, String role, String tenantId) {
    public boolean isPlatformWide() {
        return tenantId == null || tenantId.isBlank();
    }
}
