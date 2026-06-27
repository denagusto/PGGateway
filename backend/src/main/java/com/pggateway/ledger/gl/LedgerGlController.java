package com.pggateway.ledger.gl;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Buku Besar (general ledger) API — journal, GL, trial balance, fund safeguarding. Per ?tenant. */
@RestController
@RequestMapping("/api/ledger")
public class LedgerGlController {

    private final GeneralLedgerService gl;
    private final com.pggateway.auth.TenantScope tenantScope;

    public LedgerGlController(GeneralLedgerService gl, com.pggateway.auth.TenantScope tenantScope) {
        this.gl = gl;
        this.tenantScope = tenantScope;
    }

    @GetMapping("/general")
    public List<GeneralLedgerService.LedgerLine> general(@RequestParam(required = false) String tenant) {
        return gl.generalLedger(tenantScope.resolve(tenant));
    }

    @GetMapping("/trial-balance")
    public GeneralLedgerService.TrialBalance trialBalance(@RequestParam(required = false) String tenant) {
        return gl.trialBalance(tenantScope.resolve(tenant));
    }

    @GetMapping("/safeguarding")
    public GeneralLedgerService.Safeguarding safeguarding(@RequestParam(required = false) String tenant) {
        return gl.safeguarding(tenantScope.resolve(tenant));
    }

    @GetMapping("/journal")
    public List<JournalEntry> journal(@RequestParam(required = false) String tenant,
                                      @RequestParam(defaultValue = "50") int limit) {
        return gl.journal(tenantScope.resolve(tenant), limit);
    }
}
