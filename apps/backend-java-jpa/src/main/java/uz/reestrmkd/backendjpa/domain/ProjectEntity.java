package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

@Getter
@Setter
@Entity
@Table(name = "projects")
public class ProjectEntity extends BaseEntity {

    @Column(name = "scope_id", nullable = false)
    private String scopeId;

    @Column(name = "uj_code", unique = true)
    private String ujCode;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "region")
    private String region;

    @Column(name = "district")
    private String district;

    @Column(name = "address")
    private String address;

    @Column(name = "landmark")
    private String landmark;

    @Column(name = "cadastre_number")
    private String cadastreNumber;

    @Column(name = "construction_status")
    private String constructionStatus;

    @Column(name = "date_start_project")
    private LocalDate dateStartProject;

    @Column(name = "date_end_project")
    private LocalDate dateEndProject;

    @Column(name = "date_start_fact")
    private LocalDate dateStartFact;

    @Column(name = "date_end_fact")
    private LocalDate dateEndFact;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "integration_data", columnDefinition = "jsonb")
    private Map<String, Object> integrationData;

    // УБРАЛИ ОШИБОЧНОЕ ПОЛЕ:
    // private String integrationStatus;

    @Column(name = "address_id")
    private String addressId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "land_plot_geojson", columnDefinition = "jsonb")
    private Map<String, Object> landPlotGeojson;

    @Column(name = "land_plot_area_m2")
    private BigDecimal landPlotAreaM2;
}