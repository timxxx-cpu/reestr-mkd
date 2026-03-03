package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Entity
@Table(name = "applications")
public class ApplicationEntity extends BaseEntity {

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", insertable = false, updatable = false)
    private ProjectEntity project;

    @OneToMany(mappedBy = "application", fetch = FetchType.LAZY)
    private List<ApplicationStepEntity> steps = new ArrayList<>();

    @OneToMany(mappedBy = "application", fetch = FetchType.LAZY)
    private List<ApplicationHistoryEntity> history = new ArrayList<>();

    @OneToOne(mappedBy = "application", fetch = FetchType.LAZY)
    private ApplicationLockEntity lock;

    @OneToMany(mappedBy = "application", fetch = FetchType.LAZY)
    private List<ApplicationLockAuditEntity> lockAudit = new ArrayList<>();

    @OneToMany(mappedBy = "application", fetch = FetchType.LAZY)
    private List<ObjectVersionEntity> versions = new ArrayList<>();

    @Column(name = "scope_id", nullable = false)
    private String scopeId;

    @Column(name = "internal_number")
    private String internalNumber;

    @Column(name = "external_source")
    private String externalSource;

    @Column(name = "external_id")
    private String externalId;

    @Column(name = "applicant")
    private String applicant;

    @Column(name = "submission_date")
    private Instant submissionDate;

    @Column(name = "assignee_name")
    private String assigneeName;

    @Column(name = "status", nullable = false)
    private String status = "IN_PROGRESS";

    @Column(name = "workflow_substatus", nullable = false)
    private String workflowSubstatus = "DRAFT";

    @Column(name = "current_step", nullable = false)
    private Integer currentStep = 0;

    @Column(name = "current_stage", nullable = false)
    private Integer currentStage = 1;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "integration_data", columnDefinition = "jsonb")
    private Map<String, Object> integrationData;

    @Column(name = "requested_decline_reason")
    private String requestedDeclineReason;

    @Column(name = "requested_decline_step")
    private Integer requestedDeclineStep;

    @Column(name = "requested_decline_by")
    private String requestedDeclineBy;

    @Column(name = "requested_decline_at")
    private Instant requestedDeclineAt;
}
