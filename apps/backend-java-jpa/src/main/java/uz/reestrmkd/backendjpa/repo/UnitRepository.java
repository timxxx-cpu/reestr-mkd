// UnitRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.UnitEntity;
import java.util.List;
public interface UnitRepository extends JpaRepository<UnitEntity, String> {
    List<UnitEntity> findByFloorIdIn(List<String> floorIds);
}