package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uz.reestrmkd.backend.domain.registry.model.FloorEntity;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface FloorJpaRepository extends JpaRepository<FloorEntity, UUID> {
    List<FloorEntity> findByBlockIdIn(Collection<UUID> blockIds);
    List<FloorEntity> findByBlockIdOrderByIndexAsc(UUID blockId);

    @Query("""
        select f.id as floorId, count(u.id) as parkingCount
        from FloorEntity f
        left join UnitEntity u on u.floorId = f.id and u.unitType = 'parking_place'
        join BuildingBlockEntity bb on bb.id = f.blockId
        join BuildingEntity b on b.id = bb.buildingId
        where b.projectId = :projectId
        group by f.id
    """)
    List<FloorParkingCountRow> countParkingPlacesByProjectId(@Param("projectId") UUID projectId);

    interface FloorParkingCountRow {
        UUID getFloorId();
        Long getParkingCount();
    }
}
