package uz.reestrmkd.backend.domain.project.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.domain.project.model.RegionEntity;

import java.util.Optional;
import java.util.UUID;

public interface RegionJpaRepository extends JpaRepository<RegionEntity, UUID> {
    Optional<RegionEntity> findBySoato(String soato);
}
