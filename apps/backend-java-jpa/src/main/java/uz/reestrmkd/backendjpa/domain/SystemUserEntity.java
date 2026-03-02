package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "dict_system_users")
public class SystemUserEntity extends BaseEntity { // Наследуемся от BaseEntity! (id, createdAt, updatedAt уже есть)

    @Column(name = "code", nullable = false, unique = true)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "role", nullable = false)
    private String role;

    @Column(name = "group_name")
    private String groupName;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 100;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}