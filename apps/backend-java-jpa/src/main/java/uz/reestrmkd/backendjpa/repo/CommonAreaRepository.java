package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.CommonAreaEntity;

import java.util.List;

public interface CommonAreaRepository extends JpaRepository<CommonAreaEntity, String> {
    List<CommonAreaEntity> findByFloorIdIn(List<String> floorIds);
}
