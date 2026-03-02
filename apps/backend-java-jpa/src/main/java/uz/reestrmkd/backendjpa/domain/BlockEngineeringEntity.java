package uz.reestrmkd.backendjpa.domain;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "block_engineering")
public class BlockEngineeringEntity extends BaseEntity {
    @Column(name = "block_id", nullable = false, unique = true) private String blockId;
    @Column(name = "has_electricity") private Boolean hasElectricity = false;
    @Column(name = "has_water") private Boolean hasWater = false;
    @Column(name = "has_hot_water") private Boolean hasHotWater = false;
    @Column(name = "has_sewerage") private Boolean hasSewerage = false;
    @Column(name = "has_gas") private Boolean hasGas = false;
    @Column(name = "has_heating") private Boolean hasHeating = false;
    @Column(name = "has_heating_local") private Boolean hasHeatingLocal = false;
    @Column(name = "has_heating_central") private Boolean hasHeatingCentral = false;
    @Column(name = "has_ventilation") private Boolean hasVentilation = false;
    @Column(name = "has_firefighting") private Boolean hasFirefighting = false;
    @Column(name = "has_lowcurrent") private Boolean hasLowcurrent = false;
    @Column(name = "has_internet") private Boolean hasInternet = false;
    @Column(name = "has_solar_panels") private Boolean hasSolarPanels = false;
}