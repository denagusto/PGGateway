package com.pggateway.developer;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Developer / integration API — backs the Developer Portal. Lets a tenant manage API keys and
 * verify that a key authenticates ("how PJP connect with us").
 */
@RestController
@RequestMapping("/api/dev")
public class DeveloperController {

    private final ApiKeyService keys;

    public DeveloperController(ApiKeyService keys) {
        this.keys = keys;
    }

    public record CreateKeyRequest(String name, String env, List<String> scopes) {}

    /** Create a key — response carries the plaintext key + secret shown ONCE. */
    @PostMapping("/keys")
    public ApiKeyService.IssuedKey create(@RequestBody CreateKeyRequest req) {
        return keys.create(req.name(), req.env(), req.scopes());
    }

    @GetMapping("/keys")
    public List<ApiKey> list() {
        return keys.list();
    }

    @DeleteMapping("/keys/{id}")
    public ResponseEntity<Void> revoke(@PathVariable String id) {
        return keys.revoke(id) ? ResponseEntity.noContent().build() : ResponseEntity.notFound().build();
    }

    /** Demo of authenticated access: send your key as X-API-Key. */
    @GetMapping("/ping")
    public ResponseEntity<Map<String, Object>> ping(
            @RequestHeader(value = "X-API-Key", required = false) String apiKey) {
        return keys.verify(apiKey)
                .map(k -> ResponseEntity.ok(Map.<String, Object>of(
                        "ok", true, "tenantId", k.tenantId(), "name", k.name(),
                        "scopes", k.scopes(), "env", k.env())))
                .orElse(ResponseEntity.status(401).body(Map.of(
                        "ok", false, "error", "API key tidak valid atau dicabut")));
    }
}
