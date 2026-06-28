package com.pggateway.recon;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * The richer reconciliation workspace: settlement <b>runs</b> (per source, per cycle) and the
 * categorised <b>breaks</b> they produce, with full exception-management workflow (assign, status,
 * notes, aging). Seeded with realistic multi-source data so finance/ops can work it end-to-end; the
 * matching/import pipeline (camt.053, fee/MDR, three-way) lands in later waves. In-memory for now.
 */
@Component
public class ReconWorkspace {

    public static final List<String> CATEGORIES = List.of(
            "UNSETTLED", "UNEXPECTED", "AMOUNT_MISMATCH", "DUPLICATE", "LATE_SETTLEMENT", "STATUS_MISMATCH");
    public static final List<String> STATUSES = List.of("OPEN", "INVESTIGATING", "RESOLVED", "WRITTEN_OFF");

    private final List<ReconRun> runs = new ArrayList<>();
    private final Map<String, ReconBreak> breaks = new ConcurrentHashMap<>();
    private final AtomicInteger seq = new AtomicInteger();

    public ReconWorkspace() {
        seedRun("QRIS Switching", 18432, 18411, 12_840_000_000L);
        seedRun("BI-FAST", 9210, 9203, 7_410_000_000L);
        seedRun("Acquirer Bank", 4120, 4109, 5_900_000_000L);
        seedRun("Virtual Account", 6740, 6736, 3_220_000_000L);
    }

    private void seedRun(String source, int total, int matched, long valueReconciled) {
        int breakCount = total - matched;
        String runId = "run-" + source.toLowerCase(Locale.ROOT).replaceAll("[^a-z]", "") + "-20260627";
        // Seed a handful of representative breaks for this source.
        long atRisk = 0;
        for (int i = 0; i < Math.min(breakCount, 6); i++) {
            String cat = CATEGORIES.get(i % CATEGORIES.size());
            int age = new int[]{2, 9, 27, 51, 78, 122}[i % 6];
            long ledger = (long) ((i + 1) * 1_500_000) * 100;
            Long src = switch (cat) {
                case "UNSETTLED", "STATUS_MISMATCH" -> null;            // missing on source side
                case "UNEXPECTED" -> ledger;                            // missing on ledger side (set ledger null below)
                case "AMOUNT_MISMATCH" -> ledger - 70_000 * 100;        // fee/MDR-ish gap
                default -> ledger;
            };
            Long led = cat.equals("UNEXPECTED") ? null : ledger;
            Long diff = (led != null && src != null) ? led - src : null;
            long risk = Math.abs(led != null ? led : (src != null ? src : 0));
            atRisk += risk;
            String id = "brk-" + seq.incrementAndGet();
            String status = i == 0 ? "INVESTIGATING" : "OPEN";
            breaks.put(id, new ReconBreak(id, runId, source, source.substring(0, 3).toUpperCase() + "-REF-" + (1000 + i),
                    cat, led, src, diff, status, i == 0 ? "analis.finance" : "", age, "", Instant.now().minus(Duration.ofHours(age))));
        }
        double rate = total == 0 ? 100 : Math.round((double) matched / total * 10000) / 100.0;
        runs.add(new ReconRun(runId, source, "2026-06-27", "COMPLETED", total, matched, breakCount, rate,
                valueReconciled, atRisk, Instant.now().minus(Duration.ofHours(6)), Instant.now().minus(Duration.ofHours(5))));
    }

    public List<ReconRun> runs() {
        return List.copyOf(runs);
    }

    public List<ReconBreak> breaks(String status, String category, String source, String search) {
        String q = search == null ? "" : search.toLowerCase(Locale.ROOT);
        List<ReconBreak> out = new ArrayList<>();
        for (ReconBreak b : breaks.values()) {
            if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status) && !b.status().equalsIgnoreCase(status)) continue;
            if (category != null && !category.isBlank() && !"all".equalsIgnoreCase(category) && !b.category().equalsIgnoreCase(category)) continue;
            if (source != null && !source.isBlank() && !"all".equalsIgnoreCase(source) && !b.source().equalsIgnoreCase(source)) continue;
            if (!q.isEmpty() && !(b.txnRef().toLowerCase(Locale.ROOT).contains(q) || b.source().toLowerCase(Locale.ROOT).contains(q))) continue;
            out.add(b);
        }
        out.sort((a, b) -> Integer.compare(b.ageHours(), a.ageHours()));
        return out;
    }

    public Optional<ReconBreak> update(String id, String status, String assignee, String note) {
        ReconBreak b = breaks.get(id);
        if (b == null) return Optional.empty();
        if (status != null && !STATUSES.contains(status)) throw new IllegalArgumentException("status tidak valid");
        ReconBreak updated = b.with(status, assignee, note);
        breaks.put(id, updated);
        return Optional.of(updated);
    }

    public Summary summary() {
        int open = 0;
        long atRisk = 0;
        int[] aging = new int[4]; // 0-1d, 1-3d, 3-7d, >7d
        Map<String, Integer> byCat = new LinkedHashMap<>();
        for (String c : CATEGORIES) byCat.put(c, 0);
        for (ReconBreak b : breaks.values()) {
            boolean openish = b.status().equals("OPEN") || b.status().equals("INVESTIGATING");
            if (openish) {
                open++;
                atRisk += Math.abs(b.amountLedgerMinor() != null ? b.amountLedgerMinor()
                        : (b.amountSourceMinor() != null ? b.amountSourceMinor() : 0));
                int h = b.ageHours();
                aging[h <= 24 ? 0 : h <= 72 ? 1 : h <= 168 ? 2 : 3]++;
                byCat.merge(b.category(), 1, Integer::sum);
            }
        }
        double avgRate = runs.isEmpty() ? 100 : Math.round(runs.stream().mapToDouble(ReconRun::matchRatePct).average().orElse(100) * 100) / 100.0;
        return new Summary(avgRate, open, atRisk, aging[0], aging[1], aging[2], aging[3], byCat);
    }

    public record Summary(double avgMatchRatePct, int openBreaks, long valueAtRiskMinor,
                          int aging0to1d, int aging1to3d, int aging3to7d, int agingOver7d,
                          Map<String, Integer> byCategory) {}
}
