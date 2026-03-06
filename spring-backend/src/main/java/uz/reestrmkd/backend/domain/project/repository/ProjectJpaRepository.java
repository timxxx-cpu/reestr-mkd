package uz.reestrmkd.backend.domain.project.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import uz.reestrmkd.backend.domain.project.model.ProjectEntity;

import java.util.Optional;
import java.util.UUID;

public interface ProjectJpaRepository extends JpaRepository<ProjectEntity, UUID> {

    @Query("select p from ProjectEntity p where p.id = ?1 and p.scopeId = ?2")
    Optional<ProjectEntity> findByIdAndScope(UUID id, String scopeId);
}
