// FloorRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.FloorEntity;
public interface FloorRepository extends JpaRepository<FloorEntity, String> {}