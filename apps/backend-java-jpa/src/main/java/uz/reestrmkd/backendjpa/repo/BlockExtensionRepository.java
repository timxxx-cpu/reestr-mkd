package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BlockExtensionEntity;

import java.util.List;

public interface BlockExtensionRepository extends JpaRepository<BlockExtensionEntity, String> {
    List<BlockExtensionEntity> findByParentBlockIdInOrderByCreatedAtAsc(List<String> parentBlockIds);
}
