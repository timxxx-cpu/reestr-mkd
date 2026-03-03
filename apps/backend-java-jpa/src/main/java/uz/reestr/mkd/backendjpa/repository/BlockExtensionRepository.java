package uz.reestr.mkd.backendjpa.repository;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.BlockExtensionEntity;

public interface BlockExtensionRepository extends JpaRepository<BlockExtensionEntity, UUID> {
}
