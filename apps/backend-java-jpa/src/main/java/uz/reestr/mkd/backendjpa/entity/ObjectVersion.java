package uz.reestr.mkd.backendjpa.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "object_versions")
public class ObjectVersion {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "entity_type", nullable = false)
  private String entityType;

  @Column(name = "entity_id", nullable = false)
  private UUID entityId;

  @Column(name = "version_number", nullable = false)
  private Integer versionNumber;

  @Column(name = "version_status", nullable = false)
  private String versionStatus;

  @JdbcTypeCode(SqlTypes.JSON)
  @Column(name = "snapshot_data", nullable = false, columnDefinition = "jsonb")
  private Map<String, Object> snapshotData;

  @Column(name = "created_by")
  private String createdBy;

  @Column(name = "approved_by")
  private String approvedBy;

  @Column(name = "declined_by")
  private String declinedBy;

  @Column(name = "decline_reason")
  private String declineReason;

  @Column(name = "application_id")
  private UUID applicationId;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;
}
