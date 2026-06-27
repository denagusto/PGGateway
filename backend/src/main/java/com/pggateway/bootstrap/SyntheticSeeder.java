package com.pggateway.bootstrap;

import com.pggateway.eventstore.AppendOutcome;
import com.pggateway.eventstore.AppendResult;
import com.pggateway.eventstore.EventStore;
import com.pggateway.fds.FraudDetectionService;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.ingest.mirror.MirrorIngestAdapter;
import com.pggateway.ingest.mirror.MirrorPayload;
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
    private final Random rnd = new Random(42);
    private int seq = 0;

    public SyntheticSeeder(MirrorIngestAdapter adapter, EventStore store, FraudDetectionService fds) {
        this.adapter = adapter;
        this.store = store;
        this.fds = fds;
    }

    @Override
    public void run(ApplicationArguments args) {
        // normal small traffic — below every threshold, below the velocity count
        String[][] normal = {{"ACC-9", "4"}, {"ACC-21", "3"}, {"ACC-37", "4"},
                {"ACC-55", "4"}, {"ACC-63", "4"}, {"ACC-71", "4"}};
        for (String[] acc : normal) {
            int n = Integer.parseInt(acc[1]);
            for (int k = 0; k < n; k++) {
                seed(acc[0], TYPES[rnd.nextInt(TYPES.length)], (rnd.nextInt(400) + 30L) * 1000L); // Rp 30rb-430rb
            }
        }
        // LTKT — one transaction >= Rp 500 juta
        seed("ACC-BIG", "TRANSFER_INTRABANK", 600_000_000L);
        // Structuring (LTKM) — several large sub-Rp 500 juta transactions from one account
        for (int k = 0; k < 4; k++) {
            seed("ACC-STRUCT", "TRANSFER_INTRABANK", 300_000_000L);
        }
        // Unusual velocity (LTKM) — a burst on a fresh account
        for (int k = 0; k < 7; k++) {
            seed("ACC-99", "QRIS_MPM", (rnd.nextInt(200) + 50L) * 1000L);
        }
    }

    private void seed(String account, String type, long rupiah) {
        MirrorPayload p = new MirrorPayload(
                "SEED-" + seq, "REF-" + seq, type,
                new MirrorPayload.Amount(rupiah + ".00", "IDR"),
                account, "ACC-merchant", "00", null);
        seq++;
        CanonicalEvent e = adapter.normalize(p);
        AppendResult r = store.append(e);
        if (r.outcome() == AppendOutcome.APPENDED) {
            fds.inspect(e); // synchronous at seed time so alerts exist right after startup
        }
    }
}
