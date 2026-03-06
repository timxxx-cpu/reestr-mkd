package uz.reestrmkd.backend.domain.workflow.model;

public enum WorkflowSubstatus {
    DRAFT,
    REVIEW,
    REVISION,
    PENDING_DECLINE,
    RETURNED_BY_MANAGER,
    INTEGRATION,
    DONE,
    DECLINED_BY_ADMIN,
    DECLINED_BY_CONTROLLER,
    DECLINED_BY_MANAGER
}
