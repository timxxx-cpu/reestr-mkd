package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.SystemUserEntity;

import java.util.Optional;

public interface SystemUserRepository extends JpaRepository<SystemUserEntity, String> {
    // Spring сам превратит это в: SELECT * FROM dict_system_users WHERE code = ?
    Optional<SystemUserEntity> findByCode(String code);
}