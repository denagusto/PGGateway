package com.pggateway.live;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Live event stream the frontend subscribes to (EventSource). */
@RestController
public class EventStreamController {

    private final LiveBus bus;

    public EventStreamController(LiveBus bus) {
        this.bus = bus;
    }

    @GetMapping(value = "/api/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return bus.register();
    }
}
