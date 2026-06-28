package com.pggateway.fds.engine;

import com.pggateway.fds.rules.InMemoryRuleStore;
import com.pggateway.fds.rules.Rule;
import com.pggateway.fds.rules.RuleStore;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class RuleEngineTest {

    private Map<String, Object> features(long amountMinor, long aggregate, int velocity10s, int subThreshold24h) {
        Map<String, Object> f = new HashMap<>();
        f.put("amountMinor", amountMinor);
        f.put("aggregate24hMinor", aggregate);
        f.put("velocity10s", velocity10s);
        f.put("subThreshold24h", subThreshold24h);
        return f;
    }

    private List<String> ids(List<Rule> rules) {
        return rules.stream().map(Rule::id).toList();
    }

    @Test
    void fires_ltkt_and_aggregate_for_large_amount() {
        RuleEngine engine = new RuleEngine(new InMemoryRuleStore());
        var fired = ids(engine.evaluate(features(60_000_000_000L, 60_000_000_000L, 1, 0))); // Rp 600jt
        assertTrue(fired.contains("ltkt_threshold"));
        assertTrue(fired.contains("aggregate_daily"));
        assertFalse(fired.contains("structuring"));
    }

    @Test
    void fires_structuring_on_subthreshold_count() {
        RuleEngine engine = new RuleEngine(new InMemoryRuleStore());
        var fired = ids(engine.evaluate(features(30_000_000_000L, 90_000_000_000L, 1, 3))); // 3 sub-threshold
        assertTrue(fired.contains("structuring"));
    }

    @Test
    void disabled_rule_does_not_fire() {
        RuleStore store = new InMemoryRuleStore();
        store.update("ltkt_threshold", Map.of("enabled", false));
        var fired = ids(new RuleEngine(store).evaluate(features(60_000_000_000L, 60_000_000_000L, 1, 0)));
        assertFalse(fired.contains("ltkt_threshold"));
    }

    @Test
    void newly_created_rule_fires() {
        RuleStore store = new InMemoryRuleStore();
        store.create(new Rule("big_qris", "QRIS besar", "LTKM", true, 75, "#amountMinor >= 100000000L"));
        var fired = ids(new RuleEngine(store).evaluate(features(200_000_000L, 200_000_000L, 1, 0)));
        assertTrue(fired.contains("big_qris"));
    }

    @Test
    void deleted_rule_no_longer_fires() {
        RuleStore store = new InMemoryRuleStore();
        store.delete("structuring");
        assertTrue(store.get("structuring").isEmpty());
        var fired = ids(new RuleEngine(store).evaluate(features(30_000_000_000L, 30_000_000_000L, 1, 9)));
        assertFalse(fired.contains("structuring"));
    }

    @Test
    void validates_expressions() {
        RuleEngine engine = new RuleEngine(new InMemoryRuleStore());
        assertTrue(engine.valid("#amountMinor >= 1"));
        assertFalse(engine.valid("#amountMinor >>> "));
    }
}
