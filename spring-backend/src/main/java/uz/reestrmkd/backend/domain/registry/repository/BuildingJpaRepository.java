package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;

import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface BuildingJpaRepository extends JpaRepository<BuildingEntity, UUID> {
    List<BuildingEntity> findByProjectIdOrderByCreatedAtAsc(UUID projectId);
    List<BuildingEntity> findByProjectIdIn(Collection<UUID> projectIds);

    @Query(value = """
        with g as (
          select
            st_makevalid(st_multi(st_setsrid(st_geomfromgeojson(cast(:blockGeojson as text)), 3857))) as block_geom,
            st_makevalid(st_multi(st_setsrid(st_geomfromgeojson(cast(:buildingGeojson as text)), 3857))) as building_geom
        ),
        a as (
          select
            nullif(st_area(block_geom), 0) as block_area,
            st_area(st_intersection(block_geom, building_geom)) as inter_area
          from g
        )
        select coalesce(greatest((block_area - inter_area) / block_area, 0), 1)
        from a
    """, nativeQuery = true)
    Double calculateOutsideRatio(
        @Param("blockGeojson") String blockGeojson,
        @Param("buildingGeojson") String buildingGeojson
    );

    @Query(value = """
        select exists(
            select 1
            from buildings b
            where b.project_id = :projectId
              and b.id <> :buildingId
              and b.building_footprint_geom is not null
              and st_intersects(
                    st_multi(st_setsrid(st_geomfromgeojson(cast(:geojson as text)), 3857)),
                    b.building_footprint_geom
                  )
              and not st_touches(
                    st_multi(st_setsrid(st_geomfromgeojson(cast(:geojson as text)), 3857)),
                    b.building_footprint_geom
                  )
        )
    """, nativeQuery = true)
    Boolean intersectsExistingBuildingGeometry(
        @Param("projectId") UUID projectId,
        @Param("buildingId") UUID buildingId,
        @Param("geojson") String geojson
    );

    @Modifying
    @Query(value = """
        update buildings
        set footprint_geojson = cast(:geojson as jsonb),
            building_footprint_geom = st_multi(st_setsrid(st_geomfromgeojson(cast(:geojson as text)), 3857)),
            building_footprint_area_m2 = :area,
            geometry_candidate_id = :candidateId,
            updated_at = :updatedAt
        where id = :buildingId
          and project_id = :projectId
    """, nativeQuery = true)
    int updateGeometryAssignment(
        @Param("buildingId") UUID buildingId,
        @Param("projectId") UUID projectId,
        @Param("geojson") String geojson,
        @Param("area") BigDecimal area,
        @Param("candidateId") UUID candidateId,
        @Param("updatedAt") Instant updatedAt
    );

    @Modifying
    @Query(value = """
        update buildings
        set building_footprint_geom = st_multi(st_setsrid(st_geomfromgeojson(cast(:geojson as text)), 3857))
        where id = :buildingId
          and project_id = :projectId
    """, nativeQuery = true)
    int updateBuildingFootprintGeom(
        @Param("buildingId") UUID buildingId,
        @Param("projectId") UUID projectId,
        @Param("geojson") String geojson
    );

    @Modifying
    @Query(value = """
        update buildings
        set building_footprint_geom = null
        where id = :buildingId
          and project_id = :projectId
    """, nativeQuery = true)
    int clearBuildingFootprintGeom(
        @Param("buildingId") UUID buildingId,
        @Param("projectId") UUID projectId
    );

    @Query("""
        select b.dateStart as dateStart, b.dateEnd as dateEnd
        from BuildingEntity b
        where b.projectId = :projectId
    """)
    List<BuildingTimelineRow> findTimelineRowsByProjectId(@Param("projectId") UUID projectId);

    @Modifying
    @Query("update BuildingEntity b set b.cadastreNumber = :cadastre, b.updatedAt = :updatedAt where b.id = :id")
    int updateCadastreNumber(@Param("id") UUID id, @Param("cadastre") String cadastre, @Param("updatedAt") Instant updatedAt);

    interface BuildingTimelineRow {
        LocalDate getDateStart();
        LocalDate getDateEnd();
    }
}
