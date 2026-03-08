package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EntranceMatrixJpaRepository extends JpaRepository<EntranceMatrixEntity, UUID> {
    List<EntranceMatrixEntity> findByBlockIdIn(Collection<UUID> blockIds);
    List<EntranceMatrixEntity> findByBlockIdOrderByEntranceNumberAsc(UUID blockId);
    Optional<EntranceMatrixEntity> findByBlockIdAndFloorIdAndEntranceNumber(UUID blockId, UUID floorId, Integer entranceNumber);

    @Modifying
    @Query("update EntranceMatrixEntity em set em.floorId = :targetFloorId, em.updatedAt = :updatedAt where em.floorId = :sourceFloorId")
    int remapFloorId(
        @Param("sourceFloorId") UUID sourceFloorId,
        @Param("targetFloorId") UUID targetFloorId,
        @Param("updatedAt") Instant updatedAt
    );

    void deleteByBlockId(UUID blockId);
}
