package uz.reestrmkd.backend.domain.workflow.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "application_locks")
public class ApplicationLockEntity {
    
    // Сразу генерируем ID
    @Id
    private UUID id = UUID.randomUUID();

    @Column(name = "application_id", nullable = false)
    private UUID applicationId;

    @Column(name = "owner_user_id", nullable = false)
    private String ownerUserId;

    @Column(name = "owner_role")
    private String ownerRole;

    // Задаем дату по умолчанию
    @Column(name = "acquired_at")
    private Instant acquiredAt = Instant.now();

    @Column(name = "expires_at")
    private Instant expiresAt;

    // updatable = false защищает дату создания от изменений в будущем
    @Column(name = "created_at", updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    // Защитный механизм Hibernate перед сохранением в БД
    @PrePersist
    protected void onCreate() {
        if (this.id == null) this.id = UUID.randomUUID();
        if (this.createdAt == null) this.createdAt = Instant.now();
        if (this.updatedAt == null) this.updatedAt = Instant.now();
        if (this.acquiredAt == null) this.acquiredAt = Instant.now();
    }

    // Авто-обновление даты при изменении записи
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    // --- GETTERS AND SETTERS ---
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    
    public UUID getApplicationId() { return applicationId; }
    public void setApplicationId(UUID applicationId) { this.applicationId = applicationId; }
    
    public String getOwnerUserId() { return ownerUserId; }
    public void setOwnerUserId(String ownerUserId) { this.ownerUserId = ownerUserId; }
    
    public String getOwnerRole() { return ownerRole; }
    public void setOwnerRole(String ownerRole) { this.ownerRole = ownerRole; }
    
    public Instant getAcquiredAt() { return acquiredAt; }
    public void setAcquiredAt(Instant acquiredAt) { this.acquiredAt = acquiredAt; }
    
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}