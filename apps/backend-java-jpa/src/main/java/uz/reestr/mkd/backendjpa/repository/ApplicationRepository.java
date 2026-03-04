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

  @Query("""
      select a.status as status, count(a.id) as cnt
      from ApplicationEntity a
      where a.scopeId = :scopeId
        and (:assigneeName is null or a.assigneeName = :assigneeName)
        and (:isAdmin = true or exists (
            select 1 from ProjectParticipant pp
            where pp.project.id = a.projectId
              and pp.name = :actorUserId
        ))
      group by a.status
      """)
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
