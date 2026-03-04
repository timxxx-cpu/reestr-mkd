package uz.reestr.mkd.backendjpa.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
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
@ToString(exclude = "block")
@EqualsAndHashCode(exclude = "block")
@Entity
@Table(name = "block_engineering")
public class BlockEngineeringEntity {

  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @OneToOne(fetch = FetchType.LAZY, optional = false)
  @JoinColumn(name = "block_id", nullable = false, unique = true)
  private BlockEntity block;

  @Column(name = "has_electricity")
  private Boolean hasElectricity;

  @Column(name = "has_water")
  private Boolean hasWater;

  @Column(name = "has_hot_water")
  private Boolean hasHotWater;

  @Column(name = "has_sewerage")
  private Boolean hasSewerage;

  @Column(name = "has_gas")
  private Boolean hasGas;

  @Column(name = "has_heating")
  private Boolean hasHeating;

  @Column(name = "has_heating_local")
  private Boolean hasHeatingLocal;

  @Column(name = "has_heating_central")
  private Boolean hasHeatingCentral;

  @Column(name = "has_ventilation")
  private Boolean hasVentilation;

  @Column(name = "has_firefighting")
  private Boolean hasFirefighting;

  @Column(name = "has_lowcurrent")
  private Boolean hasLowcurrent;

  @Column(name = "has_internet")
  private Boolean hasInternet;

  @Column(name = "has_solar_panels")
  private Boolean hasSolarPanels;

  @CreationTimestamp
  @Column(name = "created_at", nullable = false, updatable = false)
  private OffsetDateTime createdAt;

  @UpdateTimestamp
  @Column(name = "updated_at", nullable = false)
  private OffsetDateTime updatedAt;
}
