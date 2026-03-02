// ApplicationLockRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ApplicationLockEntity;
public interface ApplicationLockRepository extends JpaRepository<ApplicationLockEntity, String> {}