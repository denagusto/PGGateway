package com.pggateway.fds.rules;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Runtime CRUD store of {@link Rule}s — the dynamic FDS policy edited from the Rules screen, no
 * redeploy. Two implementations swap by profile: an in-memory stand-in (default) and a durable
 * CockroachDB store (the 'cockroach' profile), so rule edits survive a restart.
 *
 * Amounts are minor units (scale 2): Rp 500.000.000 = 50_000_000_000.
 */
public interface RuleStore {

    List<Rule> all();

    Optional<Rule> get(String id);

    /** Create a new rule. If {@code id} is blank, one is generated. */
    Rule create(Rule r);

    /** Update fields of an existing rule (absent patch keys left unchanged). */
    Optional<Rule> update(String id, Map<String, Object> patch);

    boolean delete(String id);

    /** PPATK-aligned "best of best" defaults seeded into a fresh store. */
    static List<Rule> defaults() {
        return List.of(
                new Rule("ltkt_threshold", "Ambang LTKT — transaksi besar", "LTKT", true, 90,
                        "#amountMinor >= 50000000000L"),
                new Rule("aggregate_daily", "Akumulasi harian ≥ Rp 500 juta", "LTKT", true, 85,
                        "#aggregate24hMinor >= 50000000000L"),
                new Rule("structuring", "Structuring — pemecahan transaksi", "LTKM", true, 82,
                        "#subThreshold24h >= 3"),
                new Rule("unusual_velocity", "Frekuensi tidak wajar (velocity)", "LTKM", true, 70,
                        "#velocity10s >= 5"));
    }

    /** Apply a partial patch to a rule, leaving absent fields unchanged. */
    static Rule merge(Rule cur, Map<String, Object> patch) {
        return new Rule(cur.id(),
                patch.containsKey("name") ? str(patch.get("name")) : cur.name(),
                patch.containsKey("report") ? str(patch.get("report")) : cur.report(),
                patch.containsKey("enabled") ? bool(patch.get("enabled")) : cur.enabled(),
                patch.containsKey("score") ? num(patch.get("score")) : cur.score(),
                patch.containsKey("expression") ? str(patch.get("expression")) : cur.expression());
    }

    static String nz(String s) { return s == null ? "" : s; }
    static String str(Object o) { return o == null ? "" : o.toString(); }
    static boolean bool(Object o) { return o instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(o)); }
    static int num(Object o) { return o instanceof Number n ? n.intValue() : Integer.parseInt(String.valueOf(o)); }
}
