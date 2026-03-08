package uz.reestrmkd.backend.domain.project.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.common.api.MapPayloadDto;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class ProjectCreationService {

    private final ProjectJpaRepository projectJpaRepository;
    private final ApplicationJpaRepository applicationJpaRepository;

    public ProjectCreationService(
        ProjectJpaRepository projectJpaRepository,
        ApplicationJpaRepository applicationJpaRepository
    ) {
        this.projectJpaRepository = projectJpaRepository;
        this.applicationJpaRepository = applicationJpaRepository;
    }

    @Transactional
    public Map<String, Object> createFromApplication(MapPayloadDto payload, ActorPrincipal actor) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        String scope = body.get("scope") == null ? "" : String.valueOf(body.get("scope")).trim();
        if (scope.isBlank()) {
            throw new ApiException("scope is required", "VALIDATION_ERROR", null, 400);
        }

        Map<String, Object> appData = asMap(body.get("appData"));
        String cadastre = normalizeNullableString(appData.get("cadastre"));

        if (cadastre != null && applicationJpaRepository.countInProgressByScopeIdAndCadastreNumber(scope, cadastre) > 0) {
            throw new ApiException(
                "Отказ в принятии: по данному ЖК уже есть активное заявление в работе. Повторная подача отклонена.",
                "REAPPLICATION_BLOCKED",
                null,
                409
            );
        }

        String ujCode = generateNextProjectCode(scope);
        UUID projectId = UUID.randomUUID();
        String applicant = normalizeNullableString(appData.get("applicant"));
        String address = normalizeNullableString(appData.get("address"));
        String projectName = applicant == null ? "Новый проект" : "ЖК от " + applicant;
        Instant now = Instant.now();

        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setScopeId(scope);
        project.setUjCode(ujCode);
        project.setName(projectName);
        project.setAddress(address);
        project.setCadastreNumber(cadastre);
        project.setConstructionStatus("Проектный");
        project.setCreatedAt(now);
        project.setUpdatedAt(now);
        projectJpaRepository.save(project);

        ApplicationEntity application = new ApplicationEntity();
        application.setId(UUID.randomUUID());
        application.setProjectId(projectId);
        application.setScopeId(scope);
        application.setInternalNumber("INT-" + String.valueOf(System.currentTimeMillis()).substring(7));
        application.setExternalSource(normalizeNullableString(appData.get("source")));
        application.setExternalId(normalizeNullableString(appData.get("externalId")));
        application.setApplicant(applicant);
        application.setSubmissionDate(resolveSubmissionDate(appData.get("submissionDate"), now));
        application.setAssigneeName(actor == null ? null : actor.userId());
        application.setStatus("IN_PROGRESS");
        application.setWorkflowSubstatus("DRAFT");
        application.setCurrentStep(0);
        application.setCurrentStage(1);
        application.setCreatedAt(now);
        application.setUpdatedAt(now);
        applicationJpaRepository.save(application);

        return Map.of(
            "ok", true,
            "projectId", projectId,
            "applicationId", application.getId(),
            "ujCode", ujCode
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private String generateNextProjectCode(String scope) {
        int maxNumber = 0;
        for (String code : projectJpaRepository.findUjCodesByScopeIdOrderByUjCodeDesc(scope)) {
            if (code == null) {
                continue;
            }
            String trimmed = code.trim();
            if (!trimmed.startsWith("UJ")) {
                continue;
            }
            try {
                maxNumber = Math.max(maxNumber, Integer.parseInt(trimmed.substring(2)));
            } catch (Exception ignored) {
                // Skip malformed code values.
            }
        }
        return "UJ" + String.format("%06d", maxNumber + 1);
    }

    private String normalizeNullableString(Object value) {
        if (value == null) {
            return null;
        }
        String normalized = String.valueOf(value).trim();
        return normalized.isBlank() ? null : normalized;
    }

    private Instant resolveSubmissionDate(Object value, Instant fallback) {
        Instant parsed = parseInstant(value);
        if (parsed == null || Instant.EPOCH.equals(parsed)) {
            return fallback;
        }
        return parsed;
    }

    private Instant parseInstant(Object value) {
        if (value instanceof Instant instant) {
            return instant;
        }
        if (value instanceof java.sql.Timestamp timestamp) {
            return timestamp.toInstant();
        }
        if (value instanceof java.util.Date date) {
            return date.toInstant();
        }
        if (value == null) {
            return Instant.EPOCH;
        }
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception ignored) {
            return Instant.EPOCH;
        }
    }
}
