package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@Entity
@Table(name = "application_locks")
public class ApplicationLockEntity extends BaseEntity {

    @Column(name = "application_id", nullable = false, unique = true)
    private String applicationId;

    @Column(name = "owner_user_id", nullable = false)
    private String ownerUserId;

    @Column(name = "owner_role")
    private String ownerRole;

    @Column(name = "acquired_at", nullable = false)
    private Instant acquiredAt;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
}