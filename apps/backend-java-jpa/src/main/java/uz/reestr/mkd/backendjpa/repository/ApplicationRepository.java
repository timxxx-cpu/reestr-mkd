package uz.reestr.mkd.backendjpa.repository;

import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestr.mkd.backendjpa.entity.ApplicationEntity;

public interface ApplicationRepository extends JpaRepository<ApplicationEntity, UUID> {

  Page<ApplicationEntity> findByScopeIdOrderByUpdatedAtDesc(String scopeId, Pageable pageable);

  java.util.Optional<ApplicationEntity> findFirstByProjectIdOrderByCreatedAtDesc(UUID projectId);

 @Query(value = """
    select a.status as status, count(a.id) as cnt
    from applications a
    where a.scope_id = :scopeId
      and (cast(:assigneeName as text) is null or a.assignee_name = cast(:assigneeName as text))
      and (:isAdmin = true or exists (
          select 1 from project_participants pp
          where pp.project_id = a.project_id
            and pp.name = :actorUserId
      ))
    group by a.status
    """, nativeQuery = true)
List<StatusCountProjection> countDashboardByStatus(
    @Param("scopeId") String scopeId,
    @Param("isAdmin") boolean isAdmin,
    @Param("actorUserId") String actorUserId,
    @Param("assigneeName") String assigneeName
);
  interface StatusCountProjection {
    String getStatus();

    long getCnt();
  }
}
