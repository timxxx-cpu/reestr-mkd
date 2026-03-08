package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;

import java.time.Instant;
import java.util.Collection;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface CommonAreaJpaRepository extends JpaRepository<CommonAreaEntity, UUID> {
    List<CommonAreaEntity> findByFloorIdIn(Collection<UUID> floorIds);

    @Query("""
        select coalesce(sum(ca.area), 0)
        from CommonAreaEntity ca
        join FloorEntity f on f.id = ca.floorId
        join BuildingBlockEntity bb on bb.id = f.blockId
        join BuildingEntity b on b.id = bb.buildingId
        where b.projectId = :projectId
    """)
    BigDecimal sumAreaByProjectId(@Param("projectId") UUID projectId);

    @Modifying
    @Query("update CommonAreaEntity ca set ca.floorId = :targetFloorId, ca.updatedAt = :updatedAt where ca.floorId = :sourceFloorId")
    int remapFloorId(
        @Param("sourceFloorId") UUID sourceFloorId,
        @Param("targetFloorId") UUID targetFloorId,
        @Param("updatedAt") Instant updatedAt
    );

    @Modifying
    @Query("delete from CommonAreaEntity ca where ca.floorId in :floorIds")
    int deleteByFloorIdIn(@Param("floorIds") Collection<UUID> floorIds);
}
