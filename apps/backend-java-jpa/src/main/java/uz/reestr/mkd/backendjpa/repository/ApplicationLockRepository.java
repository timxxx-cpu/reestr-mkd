package uz.reestr.mkd.backendjpa.repository;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestr.mkd.backendjpa.entity.ApplicationLockEntity;

public interface ApplicationLockRepository extends JpaRepository<ApplicationLockEntity, UUID> {

  Optional<ApplicationLockEntity> findByApplication_Id(UUID applicationId);

  void deleteByApplication_Id(UUID applicationId);
}
