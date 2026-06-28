package com.pggateway.config;

import com.pggateway.auth.JwtAuthFilter;
import com.pggateway.auth.JwtService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Bank-grade security posture for the API:
 *   - stateless JWT bearer auth (no server session, no cookies → no CSRF surface);
 *   - RBAC by role (ADMIN / PJP / ANALYST) on mutating endpoints;
 *   - everything authenticated except login, the HMAC-protected ingest path, the SSE stream,
 *     the public signing guide, and Swagger;
 *   - security headers (CSP, deny framing).
 * Tenant isolation is enforced separately in TenantScope (tenant derived from the session).
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, JwtService jwt) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/auth/login").permitAll()
                        .requestMatchers("/api/ingest/**").permitAll()   // protected by the SNAP HMAC filter
                        .requestMatchers("/api/stream").permitAll()      // change-signals only, no data
                        .requestMatchers("/api/dev/snap-guide").permitAll()
                        .requestMatchers("/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/dev/keys").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/dev/keys/**").hasRole("ADMIN")
                        // FDS rules + watchlist are the confidential "secret sauce" — only the
                        // platform risk/fraud team (ADMIN/ANALYST) may read or change them, never PJP tenants.
                        .requestMatchers("/api/rules", "/api/rules/**").hasAnyRole("ADMIN", "ANALYST")
                        .requestMatchers("/api/fds/watchlist", "/api/fds/watchlist/**").hasAnyRole("ADMIN", "ANALYST")
                        // The ML model, its weights, metrics and training controls are part of the
                        // confidential detection stack — risk/fraud team only.
                        .requestMatchers("/api/fds/model", "/api/fds/model/**").hasAnyRole("ADMIN", "ANALYST")
                        .requestMatchers("/api/fds/scoring-config", "/api/fds/scoring-config/**").hasAnyRole("ADMIN", "ANALYST")
                        .requestMatchers("/api/fds/lists", "/api/fds/lists/**").hasAnyRole("ADMIN", "ANALYST")
                        .requestMatchers("/api/fds/entity/**").hasAnyRole("ADMIN", "ANALYST")
                        .anyRequest().authenticated())
                // 401 for unauthenticated (frontend -> show login), 403 stays for authenticated-but-forbidden
                .exceptionHandling(e -> e.authenticationEntryPoint(
                        (req, res, ex) -> res.sendError(jakarta.servlet.http.HttpServletResponse.SC_UNAUTHORIZED)))
                .addFilterBefore(new JwtAuthFilter(jwt), UsernamePasswordAuthenticationFilter.class)
                .headers(h -> h
                        .frameOptions(f -> f.deny())
                        .contentSecurityPolicy(csp -> csp.policyDirectives(
                                "default-src 'self'; frame-ancestors 'none'; base-uri 'self'")));
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration c = new CorsConfiguration();
        c.setAllowedOrigins(List.of("http://localhost:5173", "http://127.0.0.1:5173"));
        c.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        c.setAllowedHeaders(List.of("*"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", c);
        return source;
    }
}
