package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", insertable = false, updatable = false)
    private ApplicationEntity application;

    @Column(name = "action", nullable = false)
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
