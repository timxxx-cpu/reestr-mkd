package uz.reestr.mkd.backendjpa.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.ToString;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString(exclude = {"floor", "entrance"})
@EqualsAndHashCode(exclude = {"floor", "entrance"})
@Entity
@Table(name = "common_areas")
public class CommonAreaEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @ManyToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "floor_id", nullable = false)
  private FloorEntity floor;

  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "entrance_id")
  private EntranceEntity entrance;

  @Column(name = "type")
  private String type;

  @Column(name = "area", precision = 14, scale = 2)
  private BigDecimal area;

  @Column(name = "height", precision = 8, scale = 2)
  private BigDecimal height;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;
}
