// EntranceRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.EntranceEntity;
public interface EntranceRepository extends JpaRepository<EntranceEntity, String> {}