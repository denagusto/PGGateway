package com.pggateway.fds.ai;

import com.pggateway.fds.Alert;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Default, deterministic, fully in-process narrative provider. Produces a case summary, an
 * explanation, and a regulator-style report draft purely from the alert facts plus the retrieved
 * typology knowledge — no model, no network, nothing leaves the box. The draft is grounded: it cites
 * the matched typology, its regulatory mapping, and the exact indicators that matched, so an analyst
 * can trust and edit it rather than fact-check a hallucination.
 */
@Component
public class LocalTemplateProvider implements NarrativeProvider {

    private static final DateTimeFormatter DATE =
            DateTimeFormatter.ofPattern("d MMMM yyyy, HH:mm").withZone(ZoneId.of("Asia/Jakarta"));

    @Override
    public String name() {
        return "Lokal (template, on-premise)";
    }

    @Override
    public Narrative generate(Alert a, List<TypologyRetriever.Match> matches) {
        String rupiah = "Rp" + String.format("%,d", a.amountMinor() / 100);
        String when = a.createdAt() == null ? "-" : DATE.format(a.createdAt());

        String summary = "Akun " + a.account() + " memicu alert berisiko " + a.band()
                + " (skor " + a.score() + "/99) pada kanal " + a.channel() + " untuk transaksi " + rupiah
                + ". Pemicu utama: " + safe(a.ruleName(), a.rule()) + "."
                + (a.report() == null || a.report().isBlank() ? "" : " Pemetaan regulasi awal: " + a.report() + ".");

        String explanation = (a.reasons() == null || a.reasons().isEmpty())
                ? "Tidak ada rincian sinyal."
                : "Sinyal yang berkontribusi:\n" + a.reasons().stream().map(r -> "• " + r).collect(Collectors.joining("\n"));

        String reportDraft;
        if (matches.isEmpty()) {
            reportDraft = "DRAF LAPORAN — TINJAUAN MANUAL\n\n"
                    + "Subjek: akun " + a.account() + ".\nUraian: Pada " + when + ", transaksi " + rupiah + " via "
                    + a.channel() + " memicu alert FDS berisiko " + a.band() + " (skor " + a.score()
                    + "). Tidak ada tipologi pustaka yang cocok otomatis — perlu telaah analis.\n"
                    + "Rekomendasi: tinjau riwayat akun di Investigasi (Entity 360) dan tentukan verdict.";
        } else {
            TypologyRetriever.Match top = matches.get(0);
            Typology t = top.typology();
            reportDraft = "DRAF LAPORAN — " + t.code() + " (" + t.name() + ")\n\n"
                    + "Subjek: akun " + a.account() + ".\n"
                    + "Uraian: Pada " + when + ", terdeteksi transaksi " + rupiah + " via " + a.channel()
                    + " yang memicu alert FDS berisiko " + a.band() + " (skor " + a.score() + "/99). "
                    + "Pola ini konsisten dengan tipologi " + t.name() + " — indikator yang cocok: "
                    + String.join(", ", top.matchedIndicators()) + ". " + t.description() + "\n"
                    + "Rekomendasi: " + t.recommendedAction() + "\n"
                    + "Dasar regulasi: " + t.regulatoryMapping() + ".\n\n"
                    + "[Draf dibuat lokal dari fakta alert + Pustaka Tipologi. Wajib ditelaah & disetujui analis sebelum diajukan.]";
        }
        return new Narrative(summary, explanation, reportDraft);
    }

    private static String safe(String a, String b) {
        return a != null && !a.isBlank() ? a : (b == null ? "-" : b);
    }
}
