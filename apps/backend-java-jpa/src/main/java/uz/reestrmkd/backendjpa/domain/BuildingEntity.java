package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.locationtech.jts.geom.MultiPolygon;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@Entity
@Table(name = "buildings")
public class BuildingEntity extends BaseEntity {

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", insertable = false, updatable = false)
    private ProjectEntity project;

    @OneToMany(mappedBy = "building", fetch = FetchType.LAZY)
    private List<BuildingBlockEntity> blocks = new ArrayList<>();

    @OneToMany(mappedBy = "assignedBuilding", fetch = FetchType.LAZY)
    private List<ProjectGeometryCandidateEntity> assignedGeometryCandidates = new ArrayList<>();

    @Column(name = "building_code", unique = true)
    private String buildingCode;

    @Column(name = "label", nullable = false)
    private String label;

    @Column(name = "house_number")
    private String houseNumber;

    @Column(name = "address_id")
    private String addressId;

    @Column(name = "category", nullable = false)
    private String category;

    @Column(name = "stage")
    private String stage;

    @Column(name = "date_start")
    private LocalDate dateStart;

    @Column(name = "date_end")
    private LocalDate dateEnd;

    @Column(name = "construction_type")
    private String constructionType;

    @Column(name = "parking_type")
    private String parkingType;

    @Column(name = "infra_type")
    private String infraType;

    @Column(name = "has_non_res_part", nullable = false)
    private Boolean hasNonResPart = false;

    @Column(name = "cadastre_number")
    private String cadastreNumber;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "footprint_geojson", columnDefinition = "jsonb")
    private Map<String, Object> footprintGeojson;

    @Column(name = "building_footprint_geom")
    private MultiPolygon buildingFootprintGeom;

    @Column(name = "building_footprint_area_m2")
    private BigDecimal buildingFootprintAreaM2;

    @Column(name = "geometry_candidate_id")
    private String geometryCandidateId;
}
