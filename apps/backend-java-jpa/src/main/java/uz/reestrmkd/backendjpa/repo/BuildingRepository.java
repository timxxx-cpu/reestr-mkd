// BuildingRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BuildingEntity;
public interface BuildingRepository extends JpaRepository<BuildingEntity, String> {}