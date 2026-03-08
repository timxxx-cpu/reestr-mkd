package uz.reestrmkd.backend.domain.auth.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "user_roles", schema = "general")
public class UserRoleEntity {
    @Id
    private Long id;

    @Column(name = "name_uk")
    private String nameUk;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getNameUk() { return nameUk; }
    public void setNameUk(String nameUk) { this.nameUk = nameUk; }
}
