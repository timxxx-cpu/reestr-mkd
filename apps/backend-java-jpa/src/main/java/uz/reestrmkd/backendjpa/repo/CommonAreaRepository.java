// CommonAreaRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.CommonAreaEntity;
public interface CommonAreaRepository extends JpaRepository<CommonAreaEntity, String> {}