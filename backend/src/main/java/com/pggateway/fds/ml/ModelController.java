package com.pggateway.fds.ml;

import com.pggateway.audit.AuditService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Confidential FDS model + MLOps surface (ADMIN/ANALYST only — locked in SecurityConfig).
 *
 * <p>Exposes the live model card, its learned weights, evaluation metrics and training history, and
 * the two operator actions: train a challenger from the latest verdicts, and promote it to champion.
 */
@RestController
@RequestMapping("/api/fds/model")
public class ModelController {

    private final ModelTrainingService training;
    private final AuditService audit;

    public ModelController(ModelTrainingService training, AuditService audit) {
        this.training = training;
        this.audit = audit;
    }

    /** Full model card: type, version, dataset, metrics, feature weights, training history. */
    @GetMapping
    public ModelTrainingService.ModelSnapshot snapshot() {
        return training.snapshot();
    }

    /** Train a fresh model from current analyst verdicts (lands as a challenger, or auto-promotes the first one). */
    @PostMapping("/train")
    public ModelTrainingService.TrainingRun train() {
        ModelTrainingService.TrainingRun run = training.retrain();
        audit.append("fds.model.train", "v" + run.version(),
                run.status() + " n=" + run.samples() + " auc=" + run.metrics().auc());
        return run;
    }

    /** Promote the pending challenger to the live champion model. */
    @PostMapping("/promote")
    public PromoteResult promote() {
        boolean ok = training.promote();
        if (ok) audit.append("fds.model.promote", "champion", "v" + training.snapshot().championVersion());
        return new PromoteResult(ok);
    }

    public record PromoteResult(boolean promoted) {}
}
