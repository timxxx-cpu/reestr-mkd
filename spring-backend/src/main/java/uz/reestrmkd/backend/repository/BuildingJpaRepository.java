package uz.reestrmkd.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestrmkd.backend.entity.BuildingEntity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface BuildingJpaRepository extends JpaRepository<BuildingEntity, UUID> {
    List<BuildingEntity> findByProjectIdOrderByCreatedAtAsc(UUID projectId);

    @Modifying
    @Query("update BuildingEntity b set b.cadastreNumber = :cadastre, b.updatedAt = :updatedAt where b.id = :id")
    int updateCadastreNumber(@Param("id") UUID id, @Param("cadastre") String cadastre, @Param("updatedAt") Instant updatedAt);
}
