package uz.reestrmkd.backend.domain.workflow.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "applications")
public class ApplicationEntity {
    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    @Column(name = "scope_id", nullable = false)
    private String scopeId;

    @Column(name = "internal_number")
    private String internalNumber;
    @Column(name = "external_source")
    private String externalSource;
    @Column(name = "external_id")
    private String externalId;
    private String applicant;
    @Column(name = "submission_date")
    private Instant submissionDate;
    @Column(name = "assignee_name")
    private String assigneeName;
    private String status;
    @Column(name = "workflow_substatus")
    private String workflowSubstatus;
    @Column(name = "current_step")
    private Integer currentStep;
    @Column(name = "current_stage")
    private Integer currentStage;

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
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getProjectId() { return projectId; }
    public void setProjectId(UUID projectId) { this.projectId = projectId; }
    public String getScopeId() { return scopeId; }
    public void setScopeId(String scopeId) { this.scopeId = scopeId; }
    public String getInternalNumber() { return internalNumber; }
    public void setInternalNumber(String internalNumber) { this.internalNumber = internalNumber; }
    public String getExternalSource() { return externalSource; }
    public void setExternalSource(String externalSource) { this.externalSource = externalSource; }
    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }
    public String getApplicant() { return applicant; }
    public void setApplicant(String applicant) { this.applicant = applicant; }
    public Instant getSubmissionDate() { return submissionDate; }
    public void setSubmissionDate(Instant submissionDate) { this.submissionDate = submissionDate; }
    public String getAssigneeName() { return assigneeName; }
    public void setAssigneeName(String assigneeName) { this.assigneeName = assigneeName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getWorkflowSubstatus() { return workflowSubstatus; }
    public void setWorkflowSubstatus(String workflowSubstatus) { this.workflowSubstatus = workflowSubstatus; }
    public Integer getCurrentStep() { return currentStep; }
    public void setCurrentStep(Integer currentStep) { this.currentStep = currentStep; }
    public Integer getCurrentStage() { return currentStage; }
    public void setCurrentStage(Integer currentStage) { this.currentStage = currentStage; }
    public Map<String, Object> getIntegrationData() { return integrationData; }
    public void setIntegrationData(Map<String, Object> integrationData) { this.integrationData = integrationData; }
    public String getRequestedDeclineReason() { return requestedDeclineReason; }
    public void setRequestedDeclineReason(String requestedDeclineReason) { this.requestedDeclineReason = requestedDeclineReason; }
    public Integer getRequestedDeclineStep() { return requestedDeclineStep; }
    public void setRequestedDeclineStep(Integer requestedDeclineStep) { this.requestedDeclineStep = requestedDeclineStep; }
    public String getRequestedDeclineBy() { return requestedDeclineBy; }
    public void setRequestedDeclineBy(String requestedDeclineBy) { this.requestedDeclineBy = requestedDeclineBy; }
    public Instant getRequestedDeclineAt() { return requestedDeclineAt; }
    public void setRequestedDeclineAt(Instant requestedDeclineAt) { this.requestedDeclineAt = requestedDeclineAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
