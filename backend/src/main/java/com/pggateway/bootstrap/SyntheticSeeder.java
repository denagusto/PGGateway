package com.pggateway.bootstrap;

import com.pggateway.eventstore.EventStore;
import com.pggateway.fds.FraudDetectionService;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.mirror.MirrorIngestAdapter;
import com.pggateway.ingest.mirror.MirrorPayload;
import com.pggateway.ledger.LedgerProjectionService;
import com.pggateway.ledger.gl.GeneralLedgerService;
import com.pggateway.recon.ReconciliationService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Random;

/**
 * Dev seeder: pushes a controlled SNAP scenario through the REAL pipeline (ingest -> store ->
 * FDS) on startup, so the dashboard feed has data AND the FDS produces a couple of genuine
 * alerts:
 *   - normal traffic across several accounts (each kept below the velocity threshold)
 *   - one jumbo amount  -> amount_anomaly alert
 *   - a 7-transaction burst on a fresh account -> velocity_new_account alert
 *
 * Disable with pggateway.seed.enabled=false.
 */
@Component
@ConditionalOnProperty(name = "pggateway.seed.enabled", havingValue = "true", matchIfMissing = true)
public class SyntheticSeeder implements ApplicationRunner {

    private static final String[] TYPES = {"QRIS_MPM", "TRANSFER_INTRABANK", "VIRTUAL_ACCOUNT", "DIRECT_DEBIT"};

    private final MirrorIngestAdapter adapter;
    private final EventStore store;
    private final FraudDetectionService fds;
    private final LedgerProjectionService ledger;
    private final GeneralLedgerService gl;
    private final ReconciliationService recon;
    private final Random rnd = new Random(42);
    private int seq = 0;

    public SyntheticSeeder(MirrorIngestAdapter adapter, EventStore store,
                           FraudDetectionService fds, LedgerProjectionService ledger,
                           GeneralLedgerService gl, ReconciliationService recon) {
        this.adapter = adapter;
        this.store = store;
        this.fds = fds;
        this.ledger = ledger;
        this.gl = gl;
        this.recon = recon;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Two demo PJPs so the data-isolation boundary is visible: PJP-DEMO carries the fraud
        // scenarios + most traffic; PJP-BETA is a separate, clean tenant (no alerts).
        // normal small traffic — below every threshold, below the velocity count
        String[][] normal = {{"ACC-9", "4"}, {"ACC-21", "3"}, {"ACC-37", "4"},
                {"ACC-55", "4"}, {"ACC-63", "4"}, {"ACC-71", "4"}};
        for (String[] acc : normal) {
            String tenant = (acc[0].equals("ACC-63") || acc[0].equals("ACC-71")) ? "PJP-BETA" : "PJP-DEMO";
            int n = Integer.parseInt(acc[1]);
            for (int k = 0; k < n; k++) {
                seed(tenant, acc[0], TYPES[rnd.nextInt(TYPES.length)], (rnd.nextInt(400) + 30L) * 1000L); // Rp 30rb-430rb
            }
        }
        // LTKT — one transaction >= Rp 500 juta (PJP-DEMO)
        seed("PJP-DEMO", "ACC-BIG", "TRANSFER_INTRABANK", 600_000_000L);
        // Structuring (LTKM) — several large sub-Rp 500 juta transactions from one account
        for (int k = 0; k < 4; k++) {
            seed("PJP-DEMO", "ACC-STRUCT", "TRANSFER_INTRABANK", 300_000_000L);
        }
        // Unusual velocity (LTKM) — a burst on a fresh account
        for (int k = 0; k < 7; k++) {
            seed("PJP-DEMO", "ACC-99", "QRIS_MPM", (rnd.nextInt(200) + 50L) * 1000L);
        }

        // Reconciliation demo: introduce a few discrepancies vs the counterparty feed
        recon.addCounterparty("REF-23", 59_500_000_000L);    // ACC-BIG: counterparty Rp 595jt vs ledger Rp 600jt -> selisih
        recon.removeCounterparty("REF-24");                  // present on ledger only -> satu sisi
        recon.addCounterparty("REF-GHOST", 25_000_000_000L); // counterparty only (no ledger) -> satu sisi
    }

    private void seed(String tenant, String account, String type, long rupiah) {
        MirrorPayload p = new MirrorPayload(
                "SEED-" + seq, "REF-" + seq, type,
                new MirrorPayload.Amount(rupiah + ".00", "IDR"),
                account, "ACC-merchant", "00", null);
        seq++;
        CanonicalEvent e = adapter.normalize(p).withTenant(tenant);
        store.append(e); // durable + idempotent on idempotency key
        // Rebuild in-memory projections from the seed scenario on every start (so the demo is
        // populated even when the durable store already has the events from a previous run).
        fds.inspect(e);
        ledger.apply(e);
        gl.apply(e); // post the balanced journal entry to the general ledger
        recon.addCounterparty(e.txnRef(), e.amountMinor());
    }
}
