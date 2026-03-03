package uz.reestr.mkd.backendjpa.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestr.mkd.backendjpa.entity.BlockEntity;

public interface BlockRepository extends JpaRepository<BlockEntity, UUID> {

  @EntityGraph(attributePaths = {"floors", "entrances"})
  @Query("select b from BlockEntity b where b.id = :id")
  Optional<BlockEntity> findByIdWithDetails(@Param("id") UUID id);
}
