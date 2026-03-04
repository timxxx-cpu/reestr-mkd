package uz.reestr.mkd.backendjpa.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestr.mkd.backendjpa.entity.Project;

public interface ProjectRepository extends JpaRepository<Project, UUID> {

  @EntityGraph(attributePaths = {"participants", "documents"})
  Optional<Project> findByIdAndScopeId(UUID id, String scopeId);

  Page<Project> findByScopeIdOrderByUpdatedAtDesc(String scopeId, Pageable pageable);

  @Query("""
      select distinct p
      from Project p
      join p.participants pp
      where p.scopeId = :scopeId
        and pp.name = :actorUserId
      order by p.updatedAt desc
      """)
  Page<Project> findAccessibleByScopeIdOrderByUpdatedAtDesc(
      @Param("scopeId") String scopeId,
      @Param("actorUserId") String actorUserId,
      Pageable pageable
  );
}
