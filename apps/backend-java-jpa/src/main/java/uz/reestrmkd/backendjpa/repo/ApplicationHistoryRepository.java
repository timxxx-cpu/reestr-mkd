// ApplicationHistoryRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ApplicationHistoryEntity;
public interface ApplicationHistoryRepository extends JpaRepository<ApplicationHistoryEntity, String> {}