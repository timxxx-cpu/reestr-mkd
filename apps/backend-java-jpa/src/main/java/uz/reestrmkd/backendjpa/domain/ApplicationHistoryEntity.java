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
@Table(name = "application_history")
public class ApplicationHistoryEntity extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "application_id", insertable = false, updatable = false)
    private ApplicationEntity application;

    @Column(name = "action")
    private String action;

    @Column(name = "prev_status")
    private String prevStatus;

    @Column(name = "next_status")
    private String nextStatus;

    @Column(name = "user_name")
    private String userName;

    @Column(name = "comment")
    private String comment;
}
