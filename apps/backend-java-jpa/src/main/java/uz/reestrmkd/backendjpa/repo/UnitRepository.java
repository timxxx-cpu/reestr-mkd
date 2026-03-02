// UnitRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.UnitEntity;
public interface UnitRepository extends JpaRepository<UnitEntity, String> {}