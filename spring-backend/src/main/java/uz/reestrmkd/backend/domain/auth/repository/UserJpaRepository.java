package uz.reestrmkd.backend.domain.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backend.domain.auth.model.UserEntity;

import java.util.Optional;

public interface UserJpaRepository extends JpaRepository<UserEntity, Long> {
    Optional<UserEntity> findFirstByUsernameAndPasswordAndStatusTrue(String username, String password);
}
