package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.BuildingEntity;

public interface BuildingRepository extends JpaRepository<BuildingEntity, UUID> {

  List<BuildingEntity> findByProjectId(UUID projectId);

  @EntityGraph(attributePaths = {
      "blocks",
      "blocks.entrances",
      "blocks.blockConstruction",
      "blocks.blockEngineering",
      "blocks.floors",
      "blocks.floors.units",
      "blocks.floors.commonAreas"
  })
  List<BuildingEntity> findWithGraphByProjectId(UUID projectId);
}
