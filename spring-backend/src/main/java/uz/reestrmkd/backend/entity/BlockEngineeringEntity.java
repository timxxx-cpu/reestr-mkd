package uz.reestrmkd.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "block_engineering")
public class BlockEngineeringEntity {
    @Id
    private UUID id;
    @Column(name = "block_id", nullable = false)
    private UUID blockId;
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
    @Column(name = "has_heating_local")
    private Boolean hasHeatingLocal;
    @Column(name = "has_heating_central")
    private Boolean hasHeatingCentral;
    @Column(name = "has_heating")
    private Boolean hasHeating;
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
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBlockId() { return blockId; }
    public void setBlockId(UUID blockId) { this.blockId = blockId; }
    public Boolean getHasElectricity() { return hasElectricity; }
    public void setHasElectricity(Boolean hasElectricity) { this.hasElectricity = hasElectricity; }
    public Boolean getHasWater() { return hasWater; }
    public void setHasWater(Boolean hasWater) { this.hasWater = hasWater; }
    public Boolean getHasHotWater() { return hasHotWater; }
    public void setHasHotWater(Boolean hasHotWater) { this.hasHotWater = hasHotWater; }
    public Boolean getHasSewerage() { return hasSewerage; }
    public void setHasSewerage(Boolean hasSewerage) { this.hasSewerage = hasSewerage; }
    public Boolean getHasGas() { return hasGas; }
    public void setHasGas(Boolean hasGas) { this.hasGas = hasGas; }
    public Boolean getHasHeatingLocal() { return hasHeatingLocal; }
    public void setHasHeatingLocal(Boolean hasHeatingLocal) { this.hasHeatingLocal = hasHeatingLocal; }
    public Boolean getHasHeatingCentral() { return hasHeatingCentral; }
    public void setHasHeatingCentral(Boolean hasHeatingCentral) { this.hasHeatingCentral = hasHeatingCentral; }
    public Boolean getHasHeating() { return hasHeating; }
    public void setHasHeating(Boolean hasHeating) { this.hasHeating = hasHeating; }
    public Boolean getHasVentilation() { return hasVentilation; }
    public void setHasVentilation(Boolean hasVentilation) { this.hasVentilation = hasVentilation; }
    public Boolean getHasFirefighting() { return hasFirefighting; }
    public void setHasFirefighting(Boolean hasFirefighting) { this.hasFirefighting = hasFirefighting; }
    public Boolean getHasLowcurrent() { return hasLowcurrent; }
    public void setHasLowcurrent(Boolean hasLowcurrent) { this.hasLowcurrent = hasLowcurrent; }
    public Boolean getHasInternet() { return hasInternet; }
    public void setHasInternet(Boolean hasInternet) { this.hasInternet = hasInternet; }
    public Boolean getHasSolarPanels() { return hasSolarPanels; }
    public void setHasSolarPanels(Boolean hasSolarPanels) { this.hasSolarPanels = hasSolarPanels; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
