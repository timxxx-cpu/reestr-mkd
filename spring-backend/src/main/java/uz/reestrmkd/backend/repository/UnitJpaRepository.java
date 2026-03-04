package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestrmkd.backend.entity.UnitEntity;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface UnitJpaRepository extends JpaRepository<UnitEntity, UUID> {
    List<UnitEntity> findByFloorIdIn(Collection<UUID> floorIds);

    @Modifying
    @Query("update UnitEntity u set u.cadastreNumber = :cadastre, u.updatedAt = :updatedAt where u.id = :id")
    int updateCadastreNumber(@Param("id") UUID id, @Param("cadastre") String cadastre, @Param("updatedAt") Instant updatedAt);
}
