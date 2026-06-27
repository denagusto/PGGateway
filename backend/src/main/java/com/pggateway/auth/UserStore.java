package com.pggateway.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dashboard users with roles + tenant scoping. Passwords are stored BCrypt-hashed (never plain).
 * In-memory + seeded for the demo; production swaps in an identity provider (OIDC) and a user DB.
 *
 * Roles: ADMIN (platform-wide), PJP (locked to one tenant), ANALYST (platform-wide, FDS focus).
 */
@Component
public class UserStore {

    private record Stored(AuthPrincipal who, String passwordHash) {}

    private final Map<String, Stored> users = new ConcurrentHashMap<>();

    public UserStore(PasswordEncoder encoder) {
        seed(encoder, "admin", "admin123", "Administrator", "ADMIN", null);
        seed(encoder, "demo", "demo123", "Operator PJP Demo", "PJP", "PJP-DEMO");
        seed(encoder, "beta", "beta123", "Operator PJP Beta", "PJP", "PJP-BETA");
        seed(encoder, "analyst", "analyst123", "Analis Fraud", "ANALYST", null);
    }

    private void seed(PasswordEncoder enc, String user, String pass, String name, String role, String tenant) {
        users.put(user, new Stored(new AuthPrincipal(user, name, role, tenant), enc.encode(pass)));
    }

    public Optional<AuthPrincipal> authenticate(String username, String password, PasswordEncoder enc) {
        Stored s = username == null ? null : users.get(username);
        if (s != null && enc.matches(password, s.passwordHash())) return Optional.of(s.who());
        return Optional.empty();
    }
}
