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
@Table(name = "applications")
public class ApplicationEntity {
    @Id
    private String id;
    @Column(name = "project_id")
    private String projectId;
    private String status;
    @Column(name = "workflow_substatus")
    private String workflowSubstatus;
    @Column(name = "scope_id")
    private String scopeId;
}
