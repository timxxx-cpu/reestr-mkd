package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BuildingEntity;

import java.util.List;
import java.util.Optional;

public interface BuildingRepository extends JpaRepository<BuildingEntity, String> {
    List<BuildingEntity> findByProjectIdIn(List<String> projectIds);

    List<BuildingEntity> findByProjectId(String projectId);

    List<BuildingEntity> findAllByOrderByCreatedAtDesc();

    Optional<BuildingEntity> findByIdAndProjectId(String id, String projectId);
}
