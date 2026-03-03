package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.locationtech.jts.geom.MultiPolygon;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Entity
@Table(name = "building_blocks")
public class BuildingBlockEntity extends BaseEntity {

    @Column(name = "building_id", nullable = false)
    private String buildingId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "building_id", insertable = false, updatable = false)
    private BuildingEntity building;

    @OneToMany(mappedBy = "block", fetch = FetchType.LAZY)
    private List<FloorEntity> floors = new ArrayList<>();

    @OneToMany(mappedBy = "block", fetch = FetchType.LAZY)
    private List<EntranceEntity> entrances = new ArrayList<>();

    @OneToMany(mappedBy = "block", fetch = FetchType.LAZY)
    private List<BlockFloorMarkerEntity> floorMarkers = new ArrayList<>();

    @OneToMany(mappedBy = "block", fetch = FetchType.LAZY)
    private List<EntranceMatrixEntity> entranceMatrix = new ArrayList<>();

    @OneToMany(mappedBy = "parentBlock", fetch = FetchType.LAZY)
    private List<BlockExtensionEntity> extensions = new ArrayList<>();

    @OneToOne(mappedBy = "block", fetch = FetchType.LAZY)
    private BlockConstructionEntity construction;

    @OneToOne(mappedBy = "block", fetch = FetchType.LAZY)
    private BlockEngineeringEntity engineering;

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "floors_count")
    private Integer floorsCount = 0;

    @Column(name = "floors_from")
    private Integer floorsFrom;

    @Column(name = "floors_to")
    private Integer floorsTo;

    @Column(name = "entrances_count")
    private Integer entrancesCount = 0;

    @Column(name = "elevators_count")
    private Integer elevatorsCount = 0;

    @Column(name = "vehicle_entries")
    private Integer vehicleEntries = 0;

    @Column(name = "levels_depth")
    private Integer levelsDepth = 0;

    @Column(name = "light_structure_type")
    private String lightStructureType;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "parent_blocks", columnDefinition = "uuid[]")
    private List<String> parentBlocks;

    @Column(name = "is_basement_block", nullable = false)
    private Boolean isBasementBlock = false;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "linked_block_ids", columnDefinition = "uuid[]")
    private List<String> linkedBlockIds;

    @Column(name = "basement_depth")
    private Integer basementDepth;

    @Column(name = "basement_has_parking", nullable = false)
    private Boolean basementHasParking = false;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "basement_parking_levels", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> basementParkingLevels;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "basement_communications", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> basementCommunications;

    @Column(name = "has_basement")
    private Boolean hasBasement = false;

    @Column(name = "has_attic")
    private Boolean hasAttic = false;

    @Column(name = "has_loft")
    private Boolean hasLoft = false;

    @Column(name = "has_roof_expl")
    private Boolean hasRoofExpl = false;

    @Column(name = "has_custom_address")
    private Boolean hasCustomAddress = false;

    @Column(name = "custom_house_number")
    private String customHouseNumber;

    @Column(name = "address_id")
    private String addressId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "footprint_geojson", columnDefinition = "jsonb")
    private Map<String, Object> footprintGeojson;

    @Column(name = "block_footprint_geom")
    private MultiPolygon blockFootprintGeom;

    @Column(name = "block_footprint_area_m2")
    private BigDecimal blockFootprintAreaM2;
}
