package com.pggateway.ingest;

import com.pggateway.auth.TenantScope;
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
    private final TenantScope tenantScope;

    public TransactionsController(EventStore store, TenantScope tenantScope) {
        this.store = store;
        this.tenantScope = tenantScope;
    }

    @GetMapping("/transactions")
    public List<CanonicalEvent> recent(@RequestParam(defaultValue = "50") int limit,
                                       @RequestParam(required = false) String tenant) {
        return store.recent(limit, tenantScope.resolve(tenant));
    }
}
