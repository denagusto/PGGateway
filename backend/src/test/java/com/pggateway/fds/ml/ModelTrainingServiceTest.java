package com.pggateway.fds.ml;

import com.pggateway.fds.Alert;
import com.pggateway.fds.AlertStatus;
import com.pggateway.fds.InMemoryAlertStore;
import com.pggateway.ingest.Channel;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Proves the FDS ML core actually learns from analyst verdicts — not a decorative model. With a
 * separable, labelled dataset the trained model must rank fraud above non-fraud (high AUC), and the
 * MLOps lifecycle (insufficient → train → auto-promote → champion/challenger) must behave.
 */
class ModelTrainingServiceTest {

    private Alert alert(String id, int score, String band, String report, String rule,
                        List<String> reasons, long amountMinor) {
        return new Alert(id, "PJP-DEMO", "evt-" + id, "txn-" + id, "ACC-" + id, Channel.TRANSFER,
                amountMinor, score, band, rule, rule, report, reasons, AlertStatus.OPEN, Instant.EPOCH);
    }

    /** Build a store with clearly separable fraud vs false-positive cases, all with verdicts. */
    private InMemoryAlertStore seededStore(int perClass) {
        InMemoryAlertStore store = new InMemoryAlertStore();
        for (int i = 0; i < perClass; i++) {
            Alert fraud = alert("F" + i, 90, "CRITICAL", "LTKM", "watchlist_hit",
                    List.of("watchlist: penerima di daftar pantau", "velocity tinggi", "fan-out ke banyak penerima"),
                    900_000_000L);
            store.create(fraud);
            store.setVerdict(fraud.alertId(), AlertStatus.CONFIRMED_FRAUD);

            Alert legit = alert("L" + i, 45, "MEDIUM", "", "pattern",
                    List.of("nominal bulat"), 5_000_000L);
            store.create(legit);
            store.setVerdict(legit.alertId(), AlertStatus.FALSE_POSITIVE);
        }
        return store;
    }

    @Test
    void learnsToSeparateFraudFromFalsePositive() {
        ModelTrainingService svc = new ModelTrainingService(seededStore(8));

        ModelTrainingService.TrainingRun run = svc.retrain();

        assertEquals("TRAINED", run.status());
        assertTrue(run.autoPromoted(), "first trained model replaces the untrained prior");
        ModelTrainingService.ModelSnapshot snap = svc.snapshot();
        assertTrue(snap.trained());
        assertEquals(16, snap.labelledSamples());
        assertEquals(8, snap.positives());
        assertTrue(snap.championMetrics().auc() >= 0.8,
                "separable data should yield strong AUC, got " + snap.championMetrics().auc());

        // A clearly fraudulent alert must score higher than a clearly benign one.
        double pFraud = svc.scoreAlert(alert("x", 92, "CRITICAL", "LTKM", "watchlist_hit",
                List.of("watchlist", "velocity", "fan-out"), 800_000_000L));
        double pLegit = svc.scoreAlert(alert("y", 40, "LOW", "", "pattern", List.of("nominal bulat"), 2_000_000L));
        assertTrue(pFraud > pLegit, "fraud prob " + pFraud + " should exceed benign prob " + pLegit);
    }

    @Test
    void refusesToTrainWithoutBothClasses() {
        InMemoryAlertStore store = new InMemoryAlertStore();
        Alert a = alert("F0", 90, "CRITICAL", "LTKM", "watchlist_hit", List.of("watchlist"), 900_000_000L);
        store.create(a);
        store.setVerdict(a.alertId(), AlertStatus.CONFIRMED_FRAUD);

        ModelTrainingService svc = new ModelTrainingService(store);
        ModelTrainingService.TrainingRun run = svc.retrain();

        assertEquals("INSUFFICIENT", run.status());
        assertFalse(svc.snapshot().trained(), "model stays at the prior when data is insufficient");
    }
}
