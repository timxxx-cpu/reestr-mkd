package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BlockConstructionEntity;
public interface BlockConstructionRepository extends JpaRepository<BlockConstructionEntity, String> {
java.util.Optional<uz.reestrmkd.backendjpa.domain.BlockConstructionEntity> findByBlockId(String blockId);} 
