package com.pggateway.fds.scoring.detectors;

import com.pggateway.fds.engine.RuleEngine;
import com.pggateway.fds.rules.Rule;
import com.pggateway.fds.scoring.Detector;
import com.pggateway.fds.scoring.RiskSignal;
import com.pggateway.ingest.CanonicalEvent;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The REGULATORY / RULES layer. Wraps the dynamic SpEL {@link RuleEngine} so the PPATK-aligned
 * rules (LTKT, structuring, daily aggregate, velocity) become one set of signals among many —
 * present and authoritative, but not the whole FDS. Each fired rule contributes its configured
 * score and carries its PPATK report tag for the compliance officer.
 */
@Component
public class RegulatoryRuleDetector implements Detector {

    private final RuleEngine engine;

    public RegulatoryRuleDetector(RuleEngine engine) {
        this.engine = engine;
    }

    @Override
    public List<RiskSignal> evaluate(CanonicalEvent event, Map<String, Object> features) {
        List<RiskSignal> signals = new ArrayList<>();
        for (Rule r : engine.evaluate(features)) {
            signals.add(RiskSignal.regulatory(r.id(), r.name(), r.score(),
                    "Memenuhi aturan: " + r.expression(), r.report()));
        }
        return signals;
    }
}
