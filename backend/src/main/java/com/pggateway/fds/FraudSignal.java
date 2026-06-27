package com.pggateway.fds;

import java.util.List;

/** A detector's verdict when it flags a transaction. {@code null} from a detector means "clean". */
public record FraudSignal(int score, String rule, List<String> reasons) {}
