// ApplicationHistoryRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ProjectParticipantEntity;
public interface ProjectParticipantRepository extends JpaRepository<ProjectParticipantEntity, String> {}