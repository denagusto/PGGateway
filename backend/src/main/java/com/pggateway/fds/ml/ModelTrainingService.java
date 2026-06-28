package com.pggateway.fds.ml;

import com.pggateway.fds.Alert;
import com.pggateway.fds.AlertStatus;
import com.pggateway.fds.AlertStore;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * The MLOps core of the FDS: it turns the analyst's verdicts into a trained, versioned fraud model.
 *
 * <p>The training media is the case record itself — every alert an analyst marks CONFIRMED_FRAUD or
 * FALSE_POSITIVE becomes one labelled row (the {@link AlertStore} is the durable, auditable training
 * set; no separate labelling pipeline to drift out of sync). {@link #retrain()} rebuilds the dataset,
 * holds out a slice for honest evaluation, fits a {@link LogisticModel}, and records the run.
 *
 * <p>New models land as a <b>challenger</b>, not live, so a human compares it against the running
 * <b>champion</b> before {@link #promote() promoting} — the standard guardrail against a bad retrain
 * silently degrading detection. The very first trained model auto-promotes (it replaces the untrained
 * prior). Everything here is in-process and deterministic: regulator-safe, no data leaves the box.
 */
@Service
public class ModelTrainingService {

    private static final int MIN_SAMPLES = 6;
    private static final int EPOCHS = 400;
    private static final double LEARNING_RATE = 0.3;
    private static final double L2 = 0.001;

    private final AlertStore alerts;

    private volatile LogisticModel champion;
    private volatile ModelMetrics championMetrics;
    private volatile int championVersion = 1;

    private volatile LogisticModel challenger;
    private volatile ModelMetrics challengerMetrics;
    private volatile int challengerVersion;

    private volatile boolean trained = false;
    private int nextVersion = 2;
    private final List<TrainingRun> history = new ArrayList<>();

    public ModelTrainingService(AlertStore alerts) {
        this.alerts = alerts;
        this.champion = LogisticModel.prior(AlertFeaturizer.FEATURES, 0.30);
        this.championMetrics = ModelMetrics.empty();
    }

    /** Fraud probability for a live alert (used to triage / prioritise the queue). */
    public double scoreAlert(Alert a) {
        return champion.predict(AlertFeaturizer.toRow(a));
    }

    /** Rebuild the dataset from verdicts, fit a challenger, evaluate, and record the run. */
    public synchronized TrainingRun retrain() {
        List<TrainingSample> all = buildDataset();
        int pos = (int) all.stream().filter(s -> s.label() == 1).count();
        int neg = all.size() - pos;

        if (all.size() < MIN_SAMPLES || pos == 0 || neg == 0) {
            TrainingRun run = TrainingRun.insufficient(all.size(), pos, neg, MIN_SAMPLES);
            history.add(0, run);
            return run;
        }

        // Deterministic ~20% holdout, stratified by a stable hash of the alert id.
        List<TrainingSample> train = new ArrayList<>();
        List<TrainingSample> holdout = new ArrayList<>();
        for (TrainingSample s : all) {
            boolean held = Math.floorMod(s.alertId().hashCode(), 5) == 0;
            (held ? holdout : train).add(s);
        }
        if (holdout.size() < 2 || holdout.stream().noneMatch(s -> s.label() == 1)
                || holdout.stream().allMatch(s -> s.label() == 1)) {
            // too small / single-class holdout — evaluate on the full set instead of lying with a split
            holdout = all;
            train = all;
        }

        LogisticModel model = LogisticModel.train(AlertFeaturizer.FEATURES, train, EPOCHS, LEARNING_RATE, L2);
        ModelMetrics evaluated = evaluate(model, holdout);
        double championF1Before = championMetrics == null ? 0 : championMetrics.f1();

        int version = nextVersion++;
        boolean autoPromoted = !trained; // first real model replaces the untrained prior

        TrainingRun run = new TrainingRun(version, Instant.now(), all.size(), pos, neg,
                holdout.size(), evaluated, championF1Before, autoPromoted, "TRAINED");
        history.add(0, run);
        if (history.size() > 25) history.remove(history.size() - 1);

        if (autoPromoted) {
            champion = model;
            championMetrics = evaluated;
            championVersion = version;
            trained = true;
            challenger = null;
            challengerMetrics = null;
            challengerVersion = 0;
        } else {
            challenger = model;
            challengerMetrics = evaluated;
            challengerVersion = version;
        }
        return run;
    }

    /** Promote the pending challenger to champion (atomic swap of the live model). */
    public synchronized boolean promote() {
        if (challenger == null) return false;
        champion = challenger;
        championMetrics = challengerMetrics;
        championVersion = challengerVersion;
        challenger = null;
        challengerMetrics = null;
        challengerVersion = 0;
        return true;
    }

    public synchronized ModelSnapshot snapshot() {
        List<Alert> resolved = labelledAlerts();
        int pos = (int) resolved.stream().filter(a -> AlertFeaturizer.label(a) == 1).count();
        int open = alerts.list(AlertStatus.OPEN, 100000, null).size();
        return new ModelSnapshot(
                "Regresi Logistik (terkalibrasi, explainable)",
                championVersion,
                trained,
                AlertFeaturizer.FEATURES.length,
                resolved.size(), pos, resolved.size() - pos, open,
                championMetrics,
                challenger != null ? challengerVersion : 0,
                challengerMetrics,
                champion.importance(),
                List.copyOf(history));
    }

    // ---- internals ----

    private List<Alert> labelledAlerts() {
        List<Alert> out = new ArrayList<>();
        out.addAll(alerts.list(AlertStatus.CONFIRMED_FRAUD, 100000, null));
        out.addAll(alerts.list(AlertStatus.FALSE_POSITIVE, 100000, null));
        return out;
    }

    private List<TrainingSample> buildDataset() {
        List<TrainingSample> data = new ArrayList<>();
        for (Alert a : labelledAlerts()) {
            data.add(new TrainingSample(a.alertId(), AlertFeaturizer.toRow(a), AlertFeaturizer.label(a)));
        }
        return data;
    }

    private static ModelMetrics evaluate(LogisticModel model, List<TrainingSample> data) {
        int tp = 0, fp = 0, tn = 0, fn = 0;
        List<double[]> scored = new ArrayList<>(); // [prob, label]
        for (TrainingSample s : data) {
            double p = model.predict(s.features());
            scored.add(new double[] {p, s.label()});
            boolean pred = p >= 0.5;
            boolean actual = s.label() == 1;
            if (pred && actual) tp++;
            else if (pred) fp++;
            else if (actual) fn++;
            else tn++;
        }
        double precision = tp + fp == 0 ? 0 : (double) tp / (tp + fp);
        double recall = tp + fn == 0 ? 0 : (double) tp / (tp + fn);
        double f1 = precision + recall == 0 ? 0 : 2 * precision * recall / (precision + recall);
        double accuracy = data.isEmpty() ? 0 : (double) (tp + tn) / data.size();
        return new ModelMetrics(data.size(), tp, fp, tn, fn, round(precision), round(recall),
                round(f1), round(accuracy), round(auc(scored)));
    }

    /** Rank-based AUC (Mann–Whitney U), robust on small, imbalanced sets. */
    private static double auc(List<double[]> scored) {
        scored.sort((a, b) -> Double.compare(a[0], b[0]));
        double rankSumPos = 0;
        int pos = 0, neg = 0;
        for (int i = 0; i < scored.size(); i++) {
            if (scored.get(i)[1] == 1) { rankSumPos += (i + 1); pos++; } else neg++;
        }
        if (pos == 0 || neg == 0) return 0.5;
        return (rankSumPos - pos * (pos + 1) / 2.0) / ((double) pos * neg);
    }

    private static double round(double v) { return Math.round(v * 1000.0) / 1000.0; }

    // ---- DTOs (serialised straight to JSON for the FDS Console) ----

    public record ModelMetrics(int n, int tp, int fp, int tn, int fn, double precision, double recall,
                               double f1, double accuracy, double auc) {
        static ModelMetrics empty() { return new ModelMetrics(0, 0, 0, 0, 0, 0, 0, 0, 0, 0); }
    }

    public record TrainingRun(int version, Instant trainedAt, int samples, int positives, int negatives,
                              int holdout, ModelMetrics metrics, double championF1Before,
                              boolean autoPromoted, String status) {
        static TrainingRun insufficient(int samples, int pos, int neg, int min) {
            return new TrainingRun(0, Instant.now(), samples, pos, neg, 0, ModelMetrics.empty(), 0, false,
                    "INSUFFICIENT");
        }
    }

    public record ModelSnapshot(String modelType, int championVersion, boolean trained, int featureCount,
                                int labelledSamples, int positives, int negatives, int openUnlabelled,
                                ModelMetrics championMetrics, int challengerVersion,
                                ModelMetrics challengerMetrics, List<LogisticModel.FeatureWeight> weights,
                                List<TrainingRun> history) {}
}
