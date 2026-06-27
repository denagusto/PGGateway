package com.pggateway.fds.rules;

import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Runtime CRUD store of {@link Rule}s. Seeded with PPATK-aligned "best of best" defaults
 * (LTKT threshold, structuring, unusual velocity, daily aggregate). The FDS Rules screen can
 * add / edit / delete / toggle rules without a redeploy. In-memory now; later CockroachDB.
 *
 * Amounts are minor units (scale 2): Rp 500.000.000 = 50_000_000_000.
 */
@Component
public class RuleStore {

    private final Map<String, Rule> rules = new ConcurrentHashMap<>();
    private final List<String> order = new ArrayList<>(); // preserve display order
    private final AtomicLong seq = new AtomicLong();

    public RuleStore() {
        seed(new Rule("ltkt_threshold", "Ambang LTKT — transaksi besar", "LTKT", true, 90,
                "#amountMinor >= 50000000000L"));                   // Rp 500.000.000
        seed(new Rule("aggregate_daily", "Akumulasi harian ≥ Rp 500 juta", "LTKT", true, 85,
                "#aggregate24hMinor >= 50000000000L"));
        seed(new Rule("structuring", "Structuring — pemecahan transaksi", "LTKM", true, 82,
                "#subThreshold24h >= 3"));
        seed(new Rule("unusual_velocity", "Frekuensi tidak wajar (velocity)", "LTKM", true, 70,
                "#velocity10s >= 5"));
    }

    private void seed(Rule r) {
        rules.put(r.id(), r);
        order.add(r.id());
    }

    public List<Rule> all() {
        List<Rule> out = new ArrayList<>();
        synchronized (order) {
            for (String id : order) {
                Rule r = rules.get(id);
                if (r != null) out.add(r);
            }
        }
        return out;
    }

    public Optional<Rule> get(String id) {
        return Optional.ofNullable(rules.get(id));
    }

    /** Create a new rule. If {@code id} is blank, one is generated. */
    public Rule create(Rule r) {
        String id = (r.id() == null || r.id().isBlank())
                ? "rule_" + seq.incrementAndGet()
                : r.id();
        Rule created = new Rule(id, r.name(), nz(r.report()), r.enabled(), r.score(), r.expression());
        rules.put(id, created);
        synchronized (order) {
            if (!order.contains(id)) order.add(id);
        }
        return created;
    }

    /** Update fields of an existing rule (null/absent fields left unchanged). */
    public Optional<Rule> update(String id, Map<String, Object> patch) {
        Rule cur = rules.get(id);
        if (cur == null) return Optional.empty();
        Rule updated = new Rule(
                id,
                patch.containsKey("name") ? str(patch.get("name")) : cur.name(),
                patch.containsKey("report") ? str(patch.get("report")) : cur.report(),
                patch.containsKey("enabled") ? bool(patch.get("enabled")) : cur.enabled(),
                patch.containsKey("score") ? num(patch.get("score")) : cur.score(),
                patch.containsKey("expression") ? str(patch.get("expression")) : cur.expression());
        rules.put(id, updated);
        return Optional.of(updated);
    }

    public boolean delete(String id) {
        boolean existed = rules.remove(id) != null;
        synchronized (order) {
            order.remove(id);
        }
        return existed;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    private static String str(Object o) {
        return o == null ? "" : o.toString();
    }

    private static boolean bool(Object o) {
        return o instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(o));
    }

    private static int num(Object o) {
        return o instanceof Number n ? n.intValue() : Integer.parseInt(String.valueOf(o));
    }
}
