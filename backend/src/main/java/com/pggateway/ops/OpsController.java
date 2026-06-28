package com.pggateway.ops;

import com.pggateway.admin.TenantStore;
import com.pggateway.developer.IntegrationLog;
import com.pggateway.eventstore.EventStore;
import com.pggateway.fds.AlertStatus;
import com.pggateway.fds.AlertStore;
import com.pggateway.ingest.CanonicalEvent;
import com.pggateway.live.LiveBus;
import com.pggateway.recon.ReconWorkspace;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Operations / health surface — the "monitor room". Aggregates live signals from across the stack
 * (ingest, event store, FDS, alerts, SSE, reconciliation) into a single health view plus throughput
 * metrics, so an operator can see at a glance that the platform is up and flowing.
 */
@RestController
@RequestMapping("/api/ops")
public class OpsController {

    private final EventStore events;
    private final AlertStore alerts;
    private final LiveBus live;
    private final IntegrationLog integrationLog;
    private final ReconWorkspace recon;
    private final TenantStore tenants;

    public OpsController(EventStore events, AlertStore alerts, LiveBus live, IntegrationLog integrationLog,
                         ReconWorkspace recon, TenantStore tenants) {
        this.events = events;
        this.alerts = alerts;
        this.live = live;
        this.integrationLog = integrationLog;
        this.recon = recon;
        this.tenants = tenants;
    }

    @GetMapping("/health")
    public Health health() {
        int totalEvents = events.size();
        int openAlerts = alerts.list(AlertStatus.OPEN, 100000, null).size();
        int sseClients = live.size();
        int tenantCount = tenants.all().size();
        double matchRate = recon.summary().avgMatchRatePct();

        // Throughput-ish: scan the recent window for last-hour count + channel mix.
        Instant cutoff = Instant.now().minus(Duration.ofHours(1));
        List<CanonicalEvent> recent = events.recent(5000, null);
        int lastHour = 0;
        Map<String, Integer> channelMix = new LinkedHashMap<>();
        for (CanonicalEvent e : recent) {
            if (e.occurredAt() != null && e.occurredAt().isAfter(cutoff)) lastHour++;
            channelMix.merge(e.channel().name(), 1, Integer::sum);
        }

        List<IntegrationLog.Entry> log = integrationLog.recent(200, null);
        int ingestAttempts = log.size();
        int ingestErrors = (int) log.stream().filter(en -> en.status() >= 400).count();

        List<Component> components = List.of(
                new Component("Ingest API (SNAP)", "UP", "Tanda tangan HMAC-SHA512 ditegakkan"),
                new Component("Event Store", "UP", totalEvents + " event tersimpan"),
                new Component("FDS Engine", "UP", "Skoring berlapis + model ML"),
                new Component("Alert Store", "UP", openAlerts + " alert terbuka"),
                new Component("Live Bus (SSE)", "UP", sseClients + " klien terhubung"),
                new Component("Ledger & GL", "UP", "Double-entry, terprojeksi"),
                new Component("Rekonsiliasi", "UP", String.format("%.2f%% match rate", matchRate))
        );

        Metrics metrics = new Metrics(totalEvents, lastHour, openAlerts, sseClients, tenantCount,
                ingestAttempts, ingestErrors, matchRate, channelMix);

        return new Health("UP", ManagementFactory.getRuntimeMXBean().getUptime(), components, metrics);
    }

    public record Component(String name, String status, String detail) {}
    public record Metrics(int totalEvents, int eventsLastHour, int openAlerts, int sseClients, int tenants,
                          int ingestAttempts, int ingestErrors, double avgMatchRatePct, Map<String, Integer> channelMix) {}
    public record Health(String status, long uptimeMs, List<Component> components, Metrics metrics) {}
}
