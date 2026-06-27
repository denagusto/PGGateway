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

    public LedgerGlController(GeneralLedgerService gl) {
        this.gl = gl;
    }

    @GetMapping("/general")
    public List<GeneralLedgerService.LedgerLine> general(@RequestParam(required = false) String tenant) {
        return gl.generalLedger(scope(tenant));
    }

    @GetMapping("/trial-balance")
    public GeneralLedgerService.TrialBalance trialBalance(@RequestParam(required = false) String tenant) {
        return gl.trialBalance(scope(tenant));
    }

    @GetMapping("/safeguarding")
    public GeneralLedgerService.Safeguarding safeguarding(@RequestParam(required = false) String tenant) {
        return gl.safeguarding(scope(tenant));
    }

    @GetMapping("/journal")
    public List<JournalEntry> journal(@RequestParam(required = false) String tenant,
                                      @RequestParam(defaultValue = "50") int limit) {
        return gl.journal(scope(tenant), limit);
    }

    private static String scope(String tenant) {
        return (tenant == null || tenant.isBlank() || "all".equalsIgnoreCase(tenant)) ? null : tenant;
    }
}
