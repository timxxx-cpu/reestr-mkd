package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "application_lock_audit")
public class ApplicationLockAuditEntity extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "action", nullable = false) // ACQUIRE | REFRESH | RELEASE | DENY
    private String action;

    @Column(name = "actor_user_id")
    private String actorUserId;

    @Column(name = "actor_role")
    private String actorRole;

    @Column(name = "prev_owner_user_id")
    private String prevOwnerUserId;

    @Column(name = "next_owner_user_id")
    private String nextOwnerUserId;

    @Column(name = "comment")
    private String comment;
}