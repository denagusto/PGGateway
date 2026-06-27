package com.pggateway.auth;

import com.pggateway.audit.AuditService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** Login + current-user. Stateless JWT bearer auth (logout is the client dropping the token). */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserStore users;
    private final JwtService jwt;
    private final PasswordEncoder encoder;
    private final AuditService audit;

    public AuthController(UserStore users, JwtService jwt, PasswordEncoder encoder, AuditService audit) {
        this.users = users;
        this.jwt = jwt;
        this.encoder = encoder;
        this.audit = audit;
    }

    public record LoginRequest(String username, String password) {}

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest req) {
        return users.authenticate(req.username(), req.password(), encoder)
                .map(user -> {
                    audit.append("auth.login", user.username(), user.role());
                    return ResponseEntity.ok(Map.of("token", jwt.issue(user), "user", user));
                })
                .orElse(ResponseEntity.status(401).body(Map.of("error", "Username atau password salah")));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthPrincipal> me(@AuthenticationPrincipal AuthPrincipal user) {
        return user == null ? ResponseEntity.status(401).build() : ResponseEntity.ok(user);
    }
}
