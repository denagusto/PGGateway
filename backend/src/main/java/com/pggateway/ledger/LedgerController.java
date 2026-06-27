package com.pggateway.ledger;

import com.pggateway.auth.TenantScope;
import com.pggateway.eventstore.EventStore;
import com.pggateway.fds.AlertStatus;
import com.pggateway.fds.AlertStore;
import com.pggateway.fds.rules.Rule;
import com.pggateway.fds.rules.RuleStore;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Ledger + dashboard stats (real KPIs, derived from the event stream + projections). */
@RestController
@RequestMapping("/api")
public class LedgerController {

    private final LedgerProjectionService ledger;
    private final EventStore store;
    private final AlertStore alerts;
    private final RuleStore rules;
    private final TenantScope tenantScope;

    public LedgerController(LedgerProjectionService ledger, EventStore store,
                            AlertStore alerts, RuleStore rules, TenantScope tenantScope) {
        this.ledger = ledger;
        this.store = store;
        this.alerts = alerts;
        this.rules = rules;
        this.tenantScope = tenantScope;
    }

    /** Tenants (PJPs) the current user may scope to — drives the dashboard scope selector. */
    @GetMapping("/tenants")
    public List<String> tenants() {
        return tenantScope.allowedTenants(ledger.tenants());
    }

    /** Account balances (most active first), scoped to the user's tenant. */
    @GetMapping("/accounts")
    public List<AccountBalance> accounts(@RequestParam(defaultValue = "50") int limit,
                                         @RequestParam(required = false) String tenant) {
        return ledger.accounts(limit, tenantScope.resolve(tenant));
    }

    /** Real dashboard KPIs, scoped to the user's tenant. */
    @GetMapping("/stats")
    public Stats stats(@RequestParam(required = false) String tenant) {
        String t = tenantScope.resolve(tenant);
        int openAlerts = alerts.list(AlertStatus.OPEN, 10_000, t).size();
        int rulesActive = (int) rules.all().stream().filter(Rule::enabled).count();
        return new Stats(store.size(t), ledger.totalVolumeMinor(t), openAlerts,
                ledger.distinctAccounts(t), rulesActive);
    }

    public record Stats(
            int txnCount,
            long totalVolumeMinor,
            int openAlerts,
            int activeAccounts,
            int rulesActive
    ) {}
}
