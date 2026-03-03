package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(name = "project_documents")
public class ProjectDocumentEntity extends BaseEntity {

    @Column(name = "project_id", nullable = false)
    private String projectId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id", insertable = false, updatable = false)
    private ProjectEntity project;

    @Column(name = "name")
    private String name;

    @Column(name = "doc_type")
    private String docType;

    @Column(name = "doc_date")
    private LocalDate docDate;

    @Column(name = "doc_number")
    private String docNumber;

    @Column(name = "file_url")
    private String fileUrl;
}
