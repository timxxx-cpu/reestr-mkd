package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.CreateProjectFromApplicationRequest;
import uz.reestr.mkd.backendjpa.dto.ProjectRequestDtos.UpdateProjectPassportRequest;
import uz.reestr.mkd.backendjpa.entity.Project;
import uz.reestr.mkd.backendjpa.repository.ProjectRepository;

@Service
public class ProjectJpaService {

  private final ProjectRepository projectRepository;
  private final VersioningJpaService versioningJpaService;

  @PersistenceContext
  private EntityManager entityManager;

  public ProjectJpaService(ProjectRepository projectRepository, VersioningJpaService versioningJpaService) {
    this.projectRepository = projectRepository;
    this.versioningJpaService = versioningJpaService;
  }

  @Transactional
  public CreateProjectResult createProjectFromApplication(CreateProjectFromApplicationRequest request, String actorUserId) {
    String scope = trim(request.scope());
    if (scope == null || scope.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
    }

    JsonNode appData = request.appData();
    String applicant = text(appData, "applicant");
    String address = text(appData, "address");
    String cadastre = text(appData, "cadastre");
    String source = text(appData, "source");
    String externalId = text(appData, "externalId");
    String submissionDate = text(appData, "submissionDate");

    Project project = Project.builder()
        .scopeId(scope)
        .ujCode(generateNextProjectCode(scope))
        .name(applicant != null && !applicant.isBlank() ? "ЖК от " + applicant : "Новый проект")
        .address(address)
        .cadastreNumber(cadastre)
        .constructionStatus("Проектный")
        .build();

    Project saved = projectRepository.save(project);

    UUID applicationId = UUID.randomUUID();
    entityManager.createNativeQuery("""
        insert into applications(
          id, project_id, scope_id, internal_number, external_source, external_id,
          applicant, submission_date, assignee_name, status, workflow_substatus,
          current_step, current_stage, created_at, updated_at
        ) values (
          :id, :projectId, :scopeId, :internalNumber, :externalSource, :externalId,
          :applicant, :submissionDate, :assigneeName, 'IN_PROGRESS', 'DRAFT',
          0, 1, now(), now()
        )
        """)
        .setParameter("id", applicationId)
        .setParameter("projectId", saved.getId())
        .setParameter("scopeId", scope)
        .setParameter("internalNumber", "INT-" + String.valueOf(System.currentTimeMillis()).substring(7))
        .setParameter("externalSource", source)
        .setParameter("externalId", externalId)
        .setParameter("applicant", applicant)
        .setParameter("submissionDate", submissionDate == null ? Timestamp.from(Instant.now()) : Timestamp.from(Instant.parse(submissionDate)))
        .setParameter("assigneeName", actorUserId)
        .executeUpdate();

    versioningJpaService.createPendingVersionsForProject(saved.getId(), applicationId, actorUserId);

    return new CreateProjectResult(saved.getId(), applicationId, saved.getUjCode());
  }

  @Transactional
  public void validateAndUpdatePassport(UUID projectId, UpdateProjectPassportRequest request) {
    validatePassportTep(request);

    JsonNode info = request.info();
    JsonNode cadastreData = request.cadastreData();

    entityManager.createNativeQuery("""
        update projects
           set name = :name,
               construction_status = :status,
               region = :region,
               district = :district,
               address = :address,
               landmark = :landmark,
               date_start_project = :dateStartProject,
               date_end_project = :dateEndProject,
               date_start_fact = :dateStartFact,
               date_end_fact = :dateEndFact,
               cadastre_number = :cadastreNumber,
               land_plot_area_m2 = :area,
               updated_at = now()
         where id = :projectId
        """)
        .setParameter("name", text(info, "name"))
        .setParameter("status", text(info, "status"))
        .setParameter("region", text(info, "region"))
        .setParameter("district", text(info, "district"))
        .setParameter("address", text(info, "street"))
        .setParameter("landmark", text(info, "landmark"))
        .setParameter("dateStartProject", toDate(info, "dateStartProject"))
        .setParameter("dateEndProject", toDate(info, "dateEndProject"))
        .setParameter("dateStartFact", toDate(info, "dateStartFact"))
        .setParameter("dateEndFact", toDate(info, "dateEndFact"))
        .setParameter("cadastreNumber", text(cadastreData, "number"))
        .setParameter("area", toDouble(cadastreData, "area"))
        .setParameter("projectId", projectId)
        .executeUpdate();
  }

  public void validatePassportTep(UpdateProjectPassportRequest request) {
    JsonNode info = request.info();
    JsonNode cadastreData = request.cadastreData();

    String name = text(info, "name");
    if (name == null || name.trim().length() < 3) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Название должно быть не короче 3 символов");
    }

    String street = text(info, "street");
    if (street == null || street.trim().length() < 5) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Укажите корректный адрес");
    }

    LocalDate dateStartProject = toDate(info, "dateStartProject");
    LocalDate dateEndProject = toDate(info, "dateEndProject");
    if (dateStartProject != null && dateEndProject != null && !dateEndProject.isAfter(dateStartProject)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Дата окончания должна быть позже даты начала");
    }

    Double area = toDouble(cadastreData, "area");
    if (area != null && area < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Площадь не может быть отрицательной");
    }
  }

  private String generateNextProjectCode(String scope) {
    Object raw = entityManager.createNativeQuery("""
        select uj_code
          from projects
         where scope_id = :scope
           and uj_code is not null
         order by uj_code desc
         limit 1
        """)
        .setParameter("scope", scope)
        .getResultStream()
        .findFirst()
        .orElse(null);

    int next = 1;
    if (raw instanceof String code && code.startsWith("UJ")) {
      try {
        next = Integer.parseInt(code.substring(2)) + 1;
      } catch (NumberFormatException ignored) {
        next = 1;
      }
    }
    return "UJ" + String.format("%06d", next);
  }

  private static String trim(String value) {
    return value == null ? null : value.trim();
  }

  private static String text(JsonNode node, String field) {
    if (node == null || node.get(field) == null || node.get(field).isNull()) {
      return null;
    }
    return node.get(field).asText();
  }

  private static LocalDate toDate(JsonNode node, String field) {
    String value = text(node, field);
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return LocalDate.parse(value);
    } catch (DateTimeParseException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректная дата: " + field);
    }
  }

  private static Double toDouble(JsonNode node, String field) {
    String value = text(node, field);
    if (value == null || value.isBlank()) {
      return null;
    }
    try {
      return Double.parseDouble(value);
    } catch (NumberFormatException ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Некорректное число: " + field);
    }
  }

  public record CreateProjectResult(UUID projectId, UUID applicationId, String ujCode) {
  }
}
