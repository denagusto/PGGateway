package com.pggateway.bootstrap;

import com.pggateway.eventstore.EventStore;
import com.pggateway.ingest.mirror.MirrorIngestAdapter;
import com.pggateway.ingest.mirror.MirrorPayload;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Random;

/**
 * Dev seeder: pushes synthetic SNAP mirror transactions through the REAL ingest pipeline
 * on startup so the dashboard feed isn't empty. Disable with pggateway.seed.enabled=false.
 */
@Component
@ConditionalOnProperty(name = "pggateway.seed.enabled", havingValue = "true", matchIfMissing = true)
public class SyntheticSeeder implements ApplicationRunner {

    private final MirrorIngestAdapter adapter;
    private final EventStore store;

    public SyntheticSeeder(MirrorIngestAdapter adapter, EventStore store) {
        this.adapter = adapter;
        this.store = store;
    }

    @Override
    public void run(ApplicationArguments args) {
        String[] types = {"QRIS_MPM", "TRANSFER_INTRABANK", "VIRTUAL_ACCOUNT", "DIRECT_DEBIT"};
        String[] accounts = {"ACC-9", "ACC-21", "ACC-37", "ACC-55"};
        String[] statuses = {"00", "00", "00", "PENDING", "FLAGGED"}; // mostly success
        Random rnd = new Random(42); // deterministic seed

        for (int i = 0; i < 40; i++) {
            String type = types[rnd.nextInt(types.length)];
            String acc = accounts[rnd.nextInt(accounts.length)];
            String status = statuses[rnd.nextInt(statuses.length)];
            long amount = (rnd.nextInt(900) + 50L) * 1000L; // 50.000 .. 950.000
            MirrorPayload p = new MirrorPayload(
                    "SEED-" + i, "REF-" + i, type,
                    new MirrorPayload.Amount(amount + ".00", "IDR"),
                    acc, "ACC-merchant", status, null);
            store.append(adapter.normalize(p));
        }
    }
}
