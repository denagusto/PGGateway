package com.pggateway.fds.ai;

import com.pggateway.fds.Alert;

import java.util.List;

/**
 * The seam that keeps the analyst copilot pluggable while staying strictly on-premise. The copilot
 * always builds the RAG context (the matched typologies) itself; the provider only turns that
 * grounded context into prose.
 *
 * <p>The default {@link LocalTemplateProvider} is deterministic and in-process (no model, no network)
 * so it is regulator-safe and works air-gapped. To use a real model, drop in another implementation
 * that calls a <b>local</b> LLM (e.g. llama.cpp / Ollama on the same box) with the same grounded
 * context — the rest of the system is unchanged and no data leaves the environment.
 */
public interface NarrativeProvider {

    /** Display name of the active provider (shown in the UI so analysts know what generated the text). */
    String name();

    Narrative generate(Alert alert, List<TypologyRetriever.Match> matches);

    record Narrative(String summary, String explanation, String reportDraft) {}
}
