package com.pggateway.ingest;

import com.pggateway.eventstore.EventStore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Read endpoint for the portal: most recent canonical events. */
@RestController
@RequestMapping("/api")
public class TransactionsController {

    private final EventStore store;

    public TransactionsController(EventStore store) {
        this.store = store;
    }

    @GetMapping("/transactions")
    public List<CanonicalEvent> recent(@RequestParam(defaultValue = "50") int limit,
                                       @RequestParam(required = false) String tenant) {
        String scope = (tenant == null || tenant.isBlank() || "all".equalsIgnoreCase(tenant)) ? null : tenant;
        return store.recent(limit, scope);
    }
}
