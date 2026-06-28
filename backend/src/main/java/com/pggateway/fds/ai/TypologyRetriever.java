package com.pggateway.fds.ai;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * The RAG retrieval step, fully on-premise: scores every {@link Typology} in the local library
 * against a query built from an alert's evidence, by term overlap on the typologies' indicators.
 * No embeddings service, no external call — deterministic and explainable (it returns exactly which
 * indicators matched), which is what grounds the copilot's narrative in real, citable knowledge
 * rather than a hallucination.
 */
@Component
public class TypologyRetriever {

    private final TypologyLibrary library;

    public TypologyRetriever(TypologyLibrary library) {
        this.library = library;
    }

    /** Top-{@code k} typologies whose indicators appear in {@code query}, strongest first. */
    public List<Match> retrieve(String query, int k) {
        String hay = query == null ? "" : query.toLowerCase(Locale.ROOT);
        List<Match> matches = new ArrayList<>();
        for (Typology t : library.all()) {
            List<String> hits = new ArrayList<>();
            for (String ind : t.indicators()) {
                if (hay.contains(ind.toLowerCase(Locale.ROOT))) hits.add(ind);
            }
            if (!hits.isEmpty()) {
                double score = (double) hits.size() / t.indicators().size();
                matches.add(new Match(t, Math.round(score * 100) / 100.0, hits));
            }
        }
        matches.sort((a, b) -> {
            int c = Integer.compare(b.matchedIndicators().size(), a.matchedIndicators().size());
            return c != 0 ? c : Double.compare(b.score(), a.score());
        });
        return matches.size() > k ? matches.subList(0, k) : matches;
    }

    public record Match(Typology typology, double score, List<String> matchedIndicators) {}
}
