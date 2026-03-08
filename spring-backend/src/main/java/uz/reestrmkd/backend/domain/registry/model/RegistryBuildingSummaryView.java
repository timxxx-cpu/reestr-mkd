package uz.reestrmkd.backend.domain.registry.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.Immutable;

import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Immutable
@Table(name = "view_registry_buildings_summary")
public class RegistryBuildingSummaryView {
    @Id
    @Column(name = "building_id")
    private UUID buildingId;

    @Column(name = "project_name")
    private String projectName;

    @Column(name = "building_name")
    private String buildingName;

    @Column(name = "block_label")
    private String blockLabel;

    @Column(name = "building_code")
    private String buildingCode;

    @Column(name = "house_number")
    private String houseNumber;

    @Column(name = "category")
    private String category;

    @Column(name = "floors_count")
    private Integer floorsCount;

    @Column(name = "count_living")
    private Integer countLiving;

    @Column(name = "area_living_total")
    private BigDecimal areaLivingTotal;

    @Column(name = "count_commercial")
    private Integer countCommercial;

    @Column(name = "area_commercial")
    private BigDecimal areaCommercial;

    @Column(name = "count_parking")
    private Integer countParking;

    @Column(name = "area_parking")
    private BigDecimal areaParking;

    @Column(name = "area_total_sum")
    private BigDecimal areaTotalSum;

    public UUID getBuildingId() { return buildingId; }
    public void setBuildingId(UUID buildingId) { this.buildingId = buildingId; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public String getBuildingName() { return buildingName; }
    public void setBuildingName(String buildingName) { this.buildingName = buildingName; }
    public String getBlockLabel() { return blockLabel; }
    public void setBlockLabel(String blockLabel) { this.blockLabel = blockLabel; }
    public String getBuildingCode() { return buildingCode; }
    public void setBuildingCode(String buildingCode) { this.buildingCode = buildingCode; }
    public String getHouseNumber() { return houseNumber; }
    public void setHouseNumber(String houseNumber) { this.houseNumber = houseNumber; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Integer getFloorsCount() { return floorsCount; }
    public void setFloorsCount(Integer floorsCount) { this.floorsCount = floorsCount; }
    public Integer getCountLiving() { return countLiving; }
    public void setCountLiving(Integer countLiving) { this.countLiving = countLiving; }
    public BigDecimal getAreaLivingTotal() { return areaLivingTotal; }
    public void setAreaLivingTotal(BigDecimal areaLivingTotal) { this.areaLivingTotal = areaLivingTotal; }
    public Integer getCountCommercial() { return countCommercial; }
    public void setCountCommercial(Integer countCommercial) { this.countCommercial = countCommercial; }
    public BigDecimal getAreaCommercial() { return areaCommercial; }
    public void setAreaCommercial(BigDecimal areaCommercial) { this.areaCommercial = areaCommercial; }
    public Integer getCountParking() { return countParking; }
    public void setCountParking(Integer countParking) { this.countParking = countParking; }
    public BigDecimal getAreaParking() { return areaParking; }
    public void setAreaParking(BigDecimal areaParking) { this.areaParking = areaParking; }
    public BigDecimal getAreaTotalSum() { return areaTotalSum; }
    public void setAreaTotalSum(BigDecimal areaTotalSum) { this.areaTotalSum = areaTotalSum; }
}
