package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.SystemUserEntity;

public interface SystemUserRepository extends JpaRepository<SystemUserEntity, String> {}
