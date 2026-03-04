package uz.reestrmkd.backend.entity;

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
@Table(name = "application_steps")
public class ApplicationStepEntity {
    @Id
    private UUID id;
    @Column(name = "application_id", nullable = false)
    private UUID applicationId;
    @Column(name = "step_index", nullable = false)
    private Integer stepIndex;
    @Column(name = "is_completed")
    private Boolean isCompleted;
    @Column(name = "is_verified")
    private Boolean isVerified;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "block_statuses", columnDefinition = "jsonb")
    private Map<String, Object> blockStatuses;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getApplicationId() { return applicationId; }
    public void setApplicationId(UUID applicationId) { this.applicationId = applicationId; }
    public Integer getStepIndex() { return stepIndex; }
    public void setStepIndex(Integer stepIndex) { this.stepIndex = stepIndex; }
    public Boolean getIsCompleted() { return isCompleted; }
    public void setIsCompleted(Boolean completed) { isCompleted = completed; }
    public Boolean getIsVerified() { return isVerified; }
    public void setIsVerified(Boolean verified) { isVerified = verified; }
    public Map<String, Object> getBlockStatuses() { return blockStatuses; }
    public void setBlockStatuses(Map<String, Object> blockStatuses) { this.blockStatuses = blockStatuses; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
