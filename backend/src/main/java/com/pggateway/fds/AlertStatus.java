package com.pggateway.fds;

/** Lifecycle of a fraud alert. */
public enum AlertStatus {
    OPEN,
    CONFIRMED_FRAUD,
    FALSE_POSITIVE
}
