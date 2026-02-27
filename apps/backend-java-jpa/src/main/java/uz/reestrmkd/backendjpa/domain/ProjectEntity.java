package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "projects")
public class ProjectEntity {
    @Id
    private String id;
    private String name;
    @Column(name = "scope_id")
    private String scopeId;
    @Column(name = "integration_status")
    private String integrationStatus;
}
