package com.pggateway.live;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Server-Sent Events bus: server-&gt;client push so the dashboard updates the instant something
 * changes — no manual refresh, no polling lag. The data producers (ingest, FDS, ledgers) call
 * {@link #publish} with a resource type; the browser invalidates just that query and refetches the
 * authoritative data over REST (SSE carries the "what changed" signal, not the payload, so the
 * cache never diverges from the source of truth).
 *
 * A 15s heartbeat comment keeps connections alive through proxies and prunes dead clients. Smart
 * polling stays on as a resilient fallback when a connection drops. For horizontal scale this fans
 * out via a Redis/Kafka pub-sub so every node's SSE clients see every event.
 */
@Component
public class LiveBus {

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "sse-heartbeat");
        t.setDaemon(true);
        return t;
    });

    public LiveBus() {
        heartbeat.scheduleAtFixedRate(this::beat, 15, 15, TimeUnit.SECONDS);
    }

    /** Open a stream for one browser. */
    public SseEmitter register() {
        SseEmitter emitter = new SseEmitter(0L); // no timeout
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(e -> emitters.remove(emitter));
        emitters.add(emitter);
        try {
            emitter.send(SseEmitter.event().name("hello").data("connected"));
        } catch (Exception ignored) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    /** Notify every connected browser that {@code type} changed (e.g. "transactions", "alerts"). */
    public void publish(String type) {
        for (SseEmitter e : new ArrayList<>(emitters)) {
            try {
                e.send(SseEmitter.event().name("change").data(type));
            } catch (Exception ex) {
                emitters.remove(e);
            }
        }
    }

    private void beat() {
        for (SseEmitter e : new ArrayList<>(emitters)) {
            try {
                e.send(SseEmitter.event().comment("hb"));
            } catch (Exception ex) {
                emitters.remove(e);
            }
        }
    }
}
