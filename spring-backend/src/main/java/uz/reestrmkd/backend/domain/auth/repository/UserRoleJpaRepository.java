package uz.reestrmkd.backend.domain.auth.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestrmkd.backend.domain.auth.model.UserRoleEntity;

import java.util.Optional;

public interface UserRoleJpaRepository extends JpaRepository<UserRoleEntity, Long> {

    @Query(value = """
        select ur.*
        from general.user_roles ur
        join general.user_attached_roles uar on ur.id = uar.user_roles_id
        where uar.users_id = :userId
        order by ur.id asc
        limit 1
    """, nativeQuery = true)
    Optional<UserRoleEntity> findFirstByUserId(@Param("userId") Long userId);
}
