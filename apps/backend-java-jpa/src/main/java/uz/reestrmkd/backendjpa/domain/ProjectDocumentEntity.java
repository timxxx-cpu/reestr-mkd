package uz.reestrmkd.backendjpa.domain;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import java.time.LocalDate;

@Getter @Setter @Entity @Table(name = "project_documents")
public class ProjectDocumentEntity extends BaseEntity {
    @Column(name = "project_id", nullable = false) private String projectId;
    @Column(name = "name") private String name;
    @Column(name = "doc_type") private String docType;
    @Column(name = "doc_date") private LocalDate docDate;
    @Column(name = "doc_number") private String docNumber;
    @Column(name = "file_url") private String fileUrl;
}