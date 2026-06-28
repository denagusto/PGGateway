package com.pggateway.fds.ml;

/**
 * One labelled training row: the feature vector extracted from a resolved alert plus its ground
 * truth from the analyst's verdict ({@code label = 1} confirmed fraud, {@code 0} false positive).
 * {@code alertId} keeps the row traceable back to the case that produced it.
 */
public record TrainingSample(String alertId, double[] features, int label) {}
