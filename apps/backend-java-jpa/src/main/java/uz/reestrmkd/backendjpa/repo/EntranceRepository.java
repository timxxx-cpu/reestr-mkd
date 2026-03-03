package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.EntranceEntity;

import java.util.List;

public interface EntranceRepository extends JpaRepository<EntranceEntity, String> {
    List<EntranceEntity> findByBlockIdIn(List<String> blockIds);
}
