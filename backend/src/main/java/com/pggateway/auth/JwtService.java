package com.pggateway.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;

import io.jsonwebtoken.security.Keys;

/**
 * Issues and verifies signed JWTs (HS256). The token carries the user's identity, role, and
 * tenant as claims so authorization is stateless. The signing secret MUST be overridden in
 * production via {@code pggateway.security.jwt.secret} (≥ 32 bytes).
 */
@Component
public class JwtService {

    private static final long TTL_MINUTES = 480; // 8 hours

    private final SecretKey key;

    public JwtService(@Value("${pggateway.security.jwt.secret:dev-only-change-me-pggateway-secret-key-32b}") String secret) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public String issue(AuthPrincipal user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.username())
                .claim("name", user.displayName())
                .claim("role", user.role())
                .claim("tenant", user.tenantId())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(TTL_MINUTES, ChronoUnit.MINUTES)))
                .signWith(key)
                .compact();
    }

    public Optional<AuthPrincipal> parse(String token) {
        try {
            Claims c = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            return Optional.of(new AuthPrincipal(
                    c.getSubject(), c.get("name", String.class), c.get("role", String.class),
                    c.get("tenant", String.class)));
        } catch (Exception e) {
            return Optional.empty(); // expired, tampered, or malformed
        }
    }
}
