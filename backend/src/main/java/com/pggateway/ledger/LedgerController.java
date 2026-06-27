package com.pggateway.ledger;

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

    public LedgerController(LedgerProjectionService ledger, EventStore store,
                            AlertStore alerts, RuleStore rules) {
        this.ledger = ledger;
        this.store = store;
        this.alerts = alerts;
        this.rules = rules;
    }

    /** Tenants (PJPs) with activity — for the dashboard tenant scope selector. */
    @GetMapping("/tenants")
    public List<String> tenants() {
        return ledger.tenants();
    }

    /** Account balances (most active first). ?tenant=PJP (blank = all tenants). */
    @GetMapping("/accounts")
    public List<AccountBalance> accounts(@RequestParam(defaultValue = "50") int limit,
                                         @RequestParam(required = false) String tenant) {
        return ledger.accounts(limit, scope(tenant));
    }

    /** Real dashboard KPIs, scoped to a tenant when ?tenant=PJP is given (blank = all tenants). */
    @GetMapping("/stats")
    public Stats stats(@RequestParam(required = false) String tenant) {
        String t = scope(tenant);
        int openAlerts = alerts.list(AlertStatus.OPEN, 10_000, t).size();
        int rulesActive = (int) rules.all().stream().filter(Rule::enabled).count();
        return new Stats(store.size(t), ledger.totalVolumeMinor(t), openAlerts,
                ledger.distinctAccounts(t), rulesActive);
    }

    private static String scope(String tenant) {
        return (tenant == null || tenant.isBlank() || "all".equalsIgnoreCase(tenant)) ? null : tenant;
    }

    public record Stats(
            int txnCount,
            long totalVolumeMinor,
            int openAlerts,
            int activeAccounts,
            int rulesActive
    ) {}
}
