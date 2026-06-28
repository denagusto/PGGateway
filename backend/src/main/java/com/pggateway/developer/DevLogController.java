package com.pggateway.developer;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Integration Monitor feed — recent ingest attempts and their outcomes, for the Developer console.
 * Lets an integrator see live whether their "send event" calls are landing or being rejected (and
 * why). JWT-authed.
 */
@RestController
@RequestMapping("/api/dev/logs")
public class DevLogController {

    private final IntegrationLog log;

    public DevLogController(IntegrationLog log) {
        this.log = log;
    }

    @GetMapping
    public List<IntegrationLog.Entry> recent(@RequestParam(defaultValue = "100") int limit,
                                             @RequestParam(required = false) String clientKey) {
        return log.recent(limit, clientKey);
    }
}
