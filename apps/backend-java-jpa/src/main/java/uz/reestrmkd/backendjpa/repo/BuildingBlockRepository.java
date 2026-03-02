// BuildingBlockRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BuildingBlockEntity;
public interface BuildingBlockRepository extends JpaRepository<BuildingBlockEntity, String> {}