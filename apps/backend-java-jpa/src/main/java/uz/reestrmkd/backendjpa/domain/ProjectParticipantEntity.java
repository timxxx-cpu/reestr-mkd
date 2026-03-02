package uz.reestrmkd.backendjpa.domain;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "project_participants")
public class ProjectParticipantEntity extends BaseEntity {
    @Column(name = "project_id", nullable = false) private String projectId;
    @Column(name = "role", nullable = false) private String role;
    @Column(name = "name") private String name;
    @Column(name = "inn") private String inn;
}