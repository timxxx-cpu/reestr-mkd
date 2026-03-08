package uz.reestrmkd.backend.domain.project.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uz.reestrmkd.backend.domain.project.model.ProjectEntity;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectJpaRepository extends JpaRepository<ProjectEntity, UUID> {

    List<ProjectEntity> findByScopeIdOrderByUpdatedAtDesc(String scopeId);

    @Query("select p from ProjectEntity p where p.id = ?1 and p.scopeId = ?2")
    Optional<ProjectEntity> findByIdAndScope(UUID id, String scopeId);

    @Query("select p.ujCode from ProjectEntity p where p.scopeId = ?1 and p.ujCode is not null order by p.ujCode desc")
    List<String> findUjCodesByScopeIdOrderByUjCodeDesc(String scopeId);

    @Query(value = "select (land_plot_geom is not null) from projects where id = :projectId", nativeQuery = true)
    Boolean hasLandPlotGeom(@Param("projectId") UUID projectId);

    @Query(value = """
        select st_coveredby(
            st_multi(st_setsrid(st_geomfromgeojson(cast(:geojson as text)), 3857)),
            land_plot_geom
        )
        from projects
        where id = :projectId
    """, nativeQuery = true)
    Boolean isGeometryCoveredByLandPlot(@Param("projectId") UUID projectId, @Param("geojson") String geojson);

    @Modifying
    @Query(value = """
        update projects
        set land_plot_geom = st_multi(st_setsrid(st_geomfromgeojson(cast(:geojson as text)), 3857))
        where id = :projectId
    """, nativeQuery = true)
    int updateLandPlotGeom(@Param("projectId") UUID projectId, @Param("geojson") String geojson);

    @Modifying
    @Query(value = "update projects set land_plot_geom = null where id = :projectId", nativeQuery = true)
    int clearLandPlotGeom(@Param("projectId") UUID projectId);

    @Query("""
        select p.id as id,
               p.ujCode as ujCode,
               p.cadastreNumber as cadastreNumber,
               p.name as name,
               p.region as region,
               p.address as address,
               p.addressId as addressId,
               p.constructionStatus as constructionStatus,
               p.updatedAt as updatedAt,
               p.createdAt as createdAt,
               count(b.id) as buildingsCount
        from ProjectEntity p
        left join BuildingEntity b on b.projectId = p.id
        where p.scopeId = :scopeId
          and p.id in :projectIds
        group by p.id, p.ujCode, p.cadastreNumber, p.name, p.region, p.address, p.addressId, p.constructionStatus, p.updatedAt, p.createdAt
    """)
    List<ProjectListRow> findProjectListRowsByScopeIdAndIdIn(
        @Param("scopeId") String scopeId,
        @Param("projectIds") Collection<UUID> projectIds
    );

    interface ProjectListRow {
        UUID getId();
        String getUjCode();
        String getCadastreNumber();
        String getName();
        String getRegion();
        String getAddress();
        UUID getAddressId();
        String getConstructionStatus();
        Instant getUpdatedAt();
        Instant getCreatedAt();
        Long getBuildingsCount();
    }
}
