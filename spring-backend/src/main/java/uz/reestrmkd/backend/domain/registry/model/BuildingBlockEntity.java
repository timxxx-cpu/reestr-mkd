package uz.reestrmkd.backend.domain.registry.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "building_blocks")
public class BuildingBlockEntity {
    @Id
    private UUID id;
    @Column(name = "building_id", nullable = false)
    private UUID buildingId;
    @Column(nullable = false)
    private String label;
    @Column(nullable = false)
    private String type;
    @Column(name = "floors_count")
    private Integer floorsCount;
    @Column(name = "floors_from")
    private Integer floorsFrom;
    @Column(name = "floors_to")
    private Integer floorsTo;
    @Column(name = "entrances_count")
    private Integer entrancesCount;
    @Column(name = "elevators_count")
    private Integer elevatorsCount;
    @Column(name = "vehicle_entries")
    private Integer vehicleEntries;
    @Column(name = "levels_depth")
    private Integer levelsDepth;
    @Column(name = "light_structure_type")
    private String lightStructureType;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "parent_blocks", columnDefinition = "uuid[]")
    private UUID[] parentBlocks;

    @Column(name = "is_basement_block")
    private Boolean isBasementBlock;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "linked_block_ids", columnDefinition = "uuid[]")
    private UUID[] linkedBlockIds;

    @Column(name = "basement_depth")
    private Integer basementDepth;
    @Column(name = "basement_has_parking")
    private Boolean basementHasParking;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "basement_parking_levels", columnDefinition = "jsonb")
    private Map<String, Object> basementParkingLevels;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "basement_communications", columnDefinition = "jsonb")
    private Map<String, Object> basementCommunications;

    @Column(name = "has_basement")
    private Boolean hasBasement;
    @Column(name = "has_attic")
    private Boolean hasAttic;
    @Column(name = "has_loft")
    private Boolean hasLoft;
    @Column(name = "has_roof_expl")
    private Boolean hasRoofExpl;
    @Column(name = "has_custom_address")
    private Boolean hasCustomAddress;
    @Column(name = "custom_house_number")
    private String customHouseNumber;
    @Column(name = "address_id")
    private UUID addressId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "footprint_geojson", columnDefinition = "jsonb")
    private Map<String, Object> footprintGeojson;

    @Column(name = "block_footprint_area_m2")
    private BigDecimal blockFootprintAreaM2;
    @Column(name = "created_at")
    private Instant createdAt;
    @Column(name = "updated_at")
    private Instant updatedAt;

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getBuildingId() { return buildingId; }
    public void setBuildingId(UUID buildingId) { this.buildingId = buildingId; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public Integer getFloorsCount() { return floorsCount; }
    public void setFloorsCount(Integer floorsCount) { this.floorsCount = floorsCount; }
    public Integer getFloorsFrom() { return floorsFrom; }
    public void setFloorsFrom(Integer floorsFrom) { this.floorsFrom = floorsFrom; }
    public Integer getFloorsTo() { return floorsTo; }
    public void setFloorsTo(Integer floorsTo) { this.floorsTo = floorsTo; }
    public Integer getEntrancesCount() { return entrancesCount; }
    public void setEntrancesCount(Integer entrancesCount) { this.entrancesCount = entrancesCount; }
    public Integer getElevatorsCount() { return elevatorsCount; }
    public void setElevatorsCount(Integer elevatorsCount) { this.elevatorsCount = elevatorsCount; }
    public Integer getVehicleEntries() { return vehicleEntries; }
    public void setVehicleEntries(Integer vehicleEntries) { this.vehicleEntries = vehicleEntries; }
    public Integer getLevelsDepth() { return levelsDepth; }
    public void setLevelsDepth(Integer levelsDepth) { this.levelsDepth = levelsDepth; }
    public String getLightStructureType() { return lightStructureType; }
    public void setLightStructureType(String lightStructureType) { this.lightStructureType = lightStructureType; }
    public UUID[] getParentBlocks() { return parentBlocks; }
    public void setParentBlocks(UUID[] parentBlocks) { this.parentBlocks = parentBlocks; }
    public Boolean getIsBasementBlock() { return isBasementBlock; }
    public void setIsBasementBlock(Boolean isBasementBlock) { this.isBasementBlock = isBasementBlock; }
    public UUID[] getLinkedBlockIds() { return linkedBlockIds; }
    public void setLinkedBlockIds(UUID[] linkedBlockIds) { this.linkedBlockIds = linkedBlockIds; }
    public Integer getBasementDepth() { return basementDepth; }
    public void setBasementDepth(Integer basementDepth) { this.basementDepth = basementDepth; }
    public Boolean getBasementHasParking() { return basementHasParking; }
    public void setBasementHasParking(Boolean basementHasParking) { this.basementHasParking = basementHasParking; }
    public Map<String, Object> getBasementParkingLevels() { return basementParkingLevels; }
    public void setBasementParkingLevels(Map<String, Object> basementParkingLevels) { this.basementParkingLevels = basementParkingLevels; }
    public Map<String, Object> getBasementCommunications() { return basementCommunications; }
    public void setBasementCommunications(Map<String, Object> basementCommunications) { this.basementCommunications = basementCommunications; }
    public Boolean getHasBasement() { return hasBasement; }
    public void setHasBasement(Boolean hasBasement) { this.hasBasement = hasBasement; }
    public Boolean getHasAttic() { return hasAttic; }
    public void setHasAttic(Boolean hasAttic) { this.hasAttic = hasAttic; }
    public Boolean getHasLoft() { return hasLoft; }
    public void setHasLoft(Boolean hasLoft) { this.hasLoft = hasLoft; }
    public Boolean getHasRoofExpl() { return hasRoofExpl; }
    public void setHasRoofExpl(Boolean hasRoofExpl) { this.hasRoofExpl = hasRoofExpl; }
    public Boolean getHasCustomAddress() { return hasCustomAddress; }
    public void setHasCustomAddress(Boolean hasCustomAddress) { this.hasCustomAddress = hasCustomAddress; }
    public String getCustomHouseNumber() { return customHouseNumber; }
    public void setCustomHouseNumber(String customHouseNumber) { this.customHouseNumber = customHouseNumber; }
    public UUID getAddressId() { return addressId; }
    public void setAddressId(UUID addressId) { this.addressId = addressId; }
    public Map<String, Object> getFootprintGeojson() { return footprintGeojson; }
    public void setFootprintGeojson(Map<String, Object> footprintGeojson) { this.footprintGeojson = footprintGeojson; }
    public BigDecimal getBlockFootprintAreaM2() { return blockFootprintAreaM2; }
    public void setBlockFootprintAreaM2(BigDecimal blockFootprintAreaM2) { this.blockFootprintAreaM2 = blockFootprintAreaM2; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public List<UUID> getLinkedBlockIdsAsList() {
        return linkedBlockIds == null ? List.of() : List.of(linkedBlockIds);
    }
}
