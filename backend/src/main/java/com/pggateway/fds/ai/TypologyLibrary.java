package com.pggateway.fds.ai;

import org.springframework.stereotype.Component;

import java.util.List;

/**
 * The fraud/AML typology knowledge base — the local corpus the RAG retriever searches and the
 * copilot grounds its narratives in. Curated on-premise (no external knowledge source), mixing the
 * Indonesian regulatory frame (PPATK LTKM/LTKT) with international scheme typologies. Each entry maps
 * to the detector signals that tend to surface it, so retrieval can match an alert to the right
 * scheme and the analyst gets a regulation-grounded draft instead of a hallucinated one.
 */
@Component
public class TypologyLibrary {

    private final List<Typology> all = List.of(
            new Typology("structuring", "LTKM", "Structuring / Smurfing", "AML",
                    "Memecah satu transaksi besar menjadi banyak transaksi kecil di bawah ambang pelaporan untuk menghindari deteksi.",
                    List.of("structuring", "pecah", "sub-threshold", "akumulasi", "ltkm", "velocity", "nominal bulat"),
                    "PPATK LTKM (Transaksi Keuangan Mencurigakan)",
                    "Agregasi transaksi 24 jam; jika pola memecah konsisten, ajukan LTKM."),
            new Typology("large_cash", "LTKT", "Transaksi Tunai/Transfer Besar", "AML",
                    "Transaksi tunggal bernilai sangat besar (≥ Rp100 juta) yang wajib dilaporkan.",
                    List.of("ltkt", "nominal besar", "regulasi", "ambang"),
                    "PPATK LTKT (Transaksi Keuangan Tunai)",
                    "Verifikasi sumber dana & tujuan; ajukan LTKT bila memenuhi ambang."),
            new Typology("mule", "MULE", "Mule Account / Fan-out", "Fraud",
                    "Dana masuk dari satu sumber lalu disebar cepat ke banyak penerima (fan-out) — ciri rekening penampung.",
                    List.of("fan-out", "fanout", "counterparty", "jaringan", "penerima", "mule", "lawan transaksi"),
                    "Indikasi pencucian uang lapis (layering)",
                    "Petakan jaringan penerima (Entity 360); bekukan & laporkan bila terkonfirmasi."),
            new Typology("ato", "ATO", "Account Takeover", "Fraud",
                    "Pengambilalihan akun — lonjakan nominal/perilaku tak biasa vs baseline akun, sering dari device/lokasi baru.",
                    List.of("anomali", "z-score", "lonjakan", "tak biasa", "baseline", "behavioral", "perilaku"),
                    "Fraud transaksional",
                    "Hubungi pemilik akun; tahan transaksi mencurigakan; reset kredensial."),
            new Typology("card_testing", "CARDTEST", "Card Testing", "Fraud",
                    "Banyak transaksi kecil beruntun untuk menguji kartu curian — burst velocity nominal kecil.",
                    List.of("velocity", "burst", "frekuensi", "kecepatan", "card-testing", "nominal kecil"),
                    "Fraud kartu",
                    "Rate-limit BIN/akun; blok sementara; eskalasi ke penerbit."),
            new Typology("sanctions", "DTTOT", "Sanksi / DTTOT", "AML",
                    "Salah satu pihak ada di daftar sanksi / DTTOT (Daftar Terduga Teroris & Organisasi Teroris).",
                    List.of("watchlist", "daftar pantau", "sanksi", "dttot", "blocklist"),
                    "Kewajiban tapis sanksi (UN/DTTOT)",
                    "Blokir segera; laporkan ke PPATK; jangan beri tahu nasabah (tipping-off)."),
            new Typology("bust_out", "BUSTOUT", "Bust-out", "Fraud",
                    "Membangun riwayat baik lalu memaksimalkan limit dan menghilang — lonjakan tajam setelah periode normal.",
                    List.of("lonjakan", "anomali", "limit", "nominal besar", "baseline"),
                    "Fraud kredit",
                    "Tinjau riwayat limit; tahan pencairan; verifikasi identitas."),
            new Typology("rapid_movement", "RAPID", "Rapid Movement of Funds", "AML",
                    "Dana berpindah sangat cepat antar akun (masuk-keluar nyaris seketika) untuk mengaburkan jejak.",
                    List.of("velocity", "secsSinceLast", "kecepatan", "fan-out", "akumulasi"),
                    "Indikasi layering",
                    "Telusuri rantai transaksi; korelasikan dengan tipologi mule.")
    );

    public List<Typology> all() {
        return all;
    }
}
