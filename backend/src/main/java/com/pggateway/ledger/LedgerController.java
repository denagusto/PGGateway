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

    /** Account balances (most active first). */
    @GetMapping("/accounts")
    public List<AccountBalance> accounts(@RequestParam(defaultValue = "50") int limit) {
        return ledger.accounts(limit);
    }

    /** Real dashboard KPIs. */
    @GetMapping("/stats")
    public Stats stats() {
        int openAlerts = alerts.list(AlertStatus.OPEN, 10_000).size();
        int rulesActive = (int) rules.all().stream().filter(Rule::enabled).count();
        return new Stats(store.size(), ledger.totalVolumeMinor(), openAlerts,
                ledger.distinctAccounts(), rulesActive);
    }

    public record Stats(
            int txnCount,
            long totalVolumeMinor,
            int openAlerts,
            int activeAccounts,
            int rulesActive
    ) {}
}
