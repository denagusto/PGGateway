package com.pggateway.fds.ai;

import com.pggateway.fds.Alert;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * The analyst copilot — a <b>complement</b> to the ML+rules core, never a decision-maker. Given a
 * case, it builds the RAG query from the alert's evidence, retrieves the matching typologies from the
 * local library, and asks the {@link NarrativeProvider} to turn that grounded context into a summary,
 * an explanation, and a regulator-style report draft. Everything runs on-premise.
 */
@Component
public class CaseCopilot {

    private static final int TOP_K = 3;

    private final TypologyRetriever retriever;
    private final NarrativeProvider provider;

    public CaseCopilot(TypologyRetriever retriever, NarrativeProvider provider) {
        this.retriever = retriever;
        this.provider = provider;
    }

    public Result forAlert(Alert a) {
        String query = buildQuery(a);
        List<TypologyRetriever.Match> matches = retriever.retrieve(query, TOP_K);
        NarrativeProvider.Narrative n = provider.generate(a, matches);

        List<MatchView> views = matches.stream()
                .map(m -> new MatchView(m.typology().code(), m.typology().name(), m.typology().category(),
                        m.score(), m.matchedIndicators(), m.typology().regulatoryMapping(),
                        m.typology().recommendedAction()))
                .toList();

        return new Result(provider.name(), n.summary(), n.explanation(), n.reportDraft(), views);
    }

    /** The retrieval query: the alert's textual evidence (headline, mapping, and every signal). */
    private static String buildQuery(Alert a) {
        StringBuilder sb = new StringBuilder();
        sb.append(nz(a.rule())).append(' ').append(nz(a.ruleName())).append(' ').append(nz(a.report())).append(' ');
        if (a.reasons() != null) a.reasons().forEach(r -> sb.append(r).append(' '));
        return sb.toString();
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    public record MatchView(String code, String name, String category, double score,
                            List<String> matchedIndicators, String regulatoryMapping, String recommendedAction) {}

    public record Result(String provider, String summary, String explanation, String reportDraft,
                         List<MatchView> matchedTypologies) {}
}
