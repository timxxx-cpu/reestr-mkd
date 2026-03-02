package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Getter
@Setter
@Entity
@Table(name = "application_steps")
public class ApplicationStepEntity extends BaseEntity {

    @Column(name = "application_id", nullable = false)
    private String applicationId;

    @Column(name = "step_index", nullable = false)
    private Integer stepIndex;

    @Column(name = "is_completed", nullable = false)
    private Boolean isCompleted = false;

    @Column(name = "is_verified", nullable = false)
    private Boolean isVerified = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "block_statuses", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> blockStatuses;
}