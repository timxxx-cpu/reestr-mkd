package uz.reestr.mkd.backendjpa.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestr.mkd.backendjpa.entity.FloorEntity;

public interface FloorRepository extends JpaRepository<FloorEntity, UUID> {

  @Query("select coalesce(sum(coalesce(f.areaProj, 0)), 0) from FloorEntity f where f.block.id = :blockId")
  BigDecimal sumAreaProjByBlockId(@Param("blockId") UUID blockId);

  List<FloorEntity> findByBlockBuildingProjectId(UUID projectId);
}
