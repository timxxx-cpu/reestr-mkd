package uz.reestrmkd.backend.domain.workflow.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "application_history")
public class ApplicationHistoryEntity {
    @Id
    private UUID id;
    @Column(name = "application_id", nullable = false)
    private UUID applicationId;
    private String action;
    @Column(name = "prev_status")
    private String prevStatus;
    @Column(name = "next_status")
    private String nextStatus;
    @Column(name = "user_name")
    private String userName;
    private String comment;
    @Column(name = "created_at")
    private Instant createdAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getApplicationId() { return applicationId; }
    public void setApplicationId(UUID applicationId) { this.applicationId = applicationId; }
    public String getAction() { return action; }
    public void setAction(String action) { this.action = action; }
    public String getPrevStatus() { return prevStatus; }
    public void setPrevStatus(String prevStatus) { this.prevStatus = prevStatus; }
    public String getNextStatus() { return nextStatus; }
    public void setNextStatus(String nextStatus) { this.nextStatus = nextStatus; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
