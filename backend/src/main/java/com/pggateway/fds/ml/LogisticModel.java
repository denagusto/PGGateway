package com.pggateway.fds.ml;

import java.util.List;

/**
 * A small, fully explainable supervised classifier: regularised logistic regression.
 *
 * <p>This is the "ML" core of the FDS, and it is deliberately a glass box, not a neural net. A bank
 * regulator (BI) must be able to see exactly why a transaction scored the way it did, so the model
 * is a linear combination of named features squashed by a sigmoid: {@code p = σ(w·x + b)}. Every
 * weight maps to one human-readable feature, so {@link #importance()} is the literal explanation of
 * what the model learned — no post-hoc SHAP approximation needed.
 *
 * <p>The model is immutable: training produces a brand-new instance (a new version). That makes
 * champion/challenger promotion atomic and gives a clean audit trail of "which weights were live
 * when this decision was made".
 */
public final class LogisticModel {

    private final String[] featureNames;
    private final double[] weights;
    private final double bias;

    LogisticModel(String[] featureNames, double[] weights, double bias) {
        this.featureNames = featureNames;
        this.weights = weights;
        this.bias = bias;
    }

    /** An untrained prior: zero weights and a bias set to the population base rate (log-odds). */
    static LogisticModel prior(String[] featureNames, double baseRate) {
        double r = Math.max(1e-4, Math.min(1 - 1e-4, baseRate));
        double b = Math.log(r / (1 - r)); // logit of the base rate
        return new LogisticModel(featureNames, new double[featureNames.length], b);
    }

    /** Probability of the positive class (fraud) for one feature row. */
    public double predict(double[] x) {
        double z = bias;
        for (int i = 0; i < weights.length && i < x.length; i++) z += weights[i] * x[i];
        return 1.0 / (1.0 + Math.exp(-z));
    }

    /**
     * Batch-train a fresh model with full-batch gradient descent and L2 regularisation. Returns a
     * new immutable model; the caller decides whether to promote it (champion/challenger).
     */
    static LogisticModel train(String[] featureNames, List<TrainingSample> data, int epochs,
                               double learningRate, double l2) {
        int n = featureNames.length;
        double[] w = new double[n];
        // start bias at the base rate so the model is calibrated from epoch 0
        double pos = 0;
        for (TrainingSample s : data) pos += s.label();
        double base = data.isEmpty() ? 0.5 : pos / data.size();
        double b = Math.log(Math.max(1e-4, Math.min(1 - 1e-4, base)) / (1 - Math.max(1e-4, Math.min(1 - 1e-4, base))));

        for (int epoch = 0; epoch < epochs; epoch++) {
            double[] gradW = new double[n];
            double gradB = 0;
            for (TrainingSample s : data) {
                double[] x = s.features();
                double z = b;
                for (int i = 0; i < n; i++) z += w[i] * x[i];
                double p = 1.0 / (1.0 + Math.exp(-z));
                double err = p - s.label();
                for (int i = 0; i < n; i++) gradW[i] += err * x[i];
                gradB += err;
            }
            double m = Math.max(1, data.size());
            for (int i = 0; i < n; i++) w[i] -= learningRate * (gradW[i] / m + l2 * w[i]);
            b -= learningRate * (gradB / m);
        }
        return new LogisticModel(featureNames, w, b);
    }

    /** Feature weights as signed importances, sorted by absolute magnitude (the explanation). */
    public List<FeatureWeight> importance() {
        java.util.List<FeatureWeight> out = new java.util.ArrayList<>();
        for (int i = 0; i < featureNames.length; i++) out.add(new FeatureWeight(featureNames[i], weights[i]));
        out.sort((a, c) -> Double.compare(Math.abs(c.weight()), Math.abs(a.weight())));
        return out;
    }

    public double bias() { return bias; }
    public String[] featureNames() { return featureNames; }

    public record FeatureWeight(String feature, double weight) {}
}
