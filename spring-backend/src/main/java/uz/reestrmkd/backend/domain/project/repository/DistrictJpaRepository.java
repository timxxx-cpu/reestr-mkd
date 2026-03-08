package uz.reestrmkd.backend.domain.project.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.domain.project.model.DistrictEntity;

import java.util.Optional;
import java.util.UUID;

public interface DistrictJpaRepository extends JpaRepository<DistrictEntity, UUID> {
    Optional<DistrictEntity> findBySoato(String soato);
}
