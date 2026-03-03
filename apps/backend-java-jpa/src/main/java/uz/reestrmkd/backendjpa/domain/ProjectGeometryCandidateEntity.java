package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.locationtech.jts.geom.MultiPolygon;

import java.math.BigDecimal;
import java.util.Map;

@Getter
@Setter
@Entity
@Table(name = "project_geometry_candidates")
public class ProjectGeometryCandidateEntity extends BaseEntity {

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", insertable = false, updatable = false)
    private ProjectEntity project;

    @Column(name = "source_index", nullable = false)
    private Integer sourceIndex;

    @Column(name = "label")
    private String label;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "properties", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> properties;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "geom_geojson", columnDefinition = "jsonb", nullable = false)
    private Map<String, Object> geomGeojson;

    @Column(name = "geom")
    private MultiPolygon geom;

    @Column(name = "area_m2")
    private BigDecimal areaM2;

    @Column(name = "is_selected_land_plot", nullable = false)
    private Boolean isSelectedLandPlot = false;

    @Column(name = "assigned_building_id")
    private String assignedBuildingId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_building_id", insertable = false, updatable = false)
    private BuildingEntity assignedBuilding;
}
