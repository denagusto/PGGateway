package com.pggateway.eventstore;

import java.util.List;

/**
 * @param outcome       APPENDED or DUPLICATE
 * @param partitionSeq  monotonic per-partition sequence assigned by the store
 * @param detectedGaps  upstream sequence numbers detected as missing (empty if none / not tracked)
 */
public record AppendResult(AppendOutcome outcome, long partitionSeq, List<Long> detectedGaps) {}
