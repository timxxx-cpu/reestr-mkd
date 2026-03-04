package uz.reestrmkd.backend.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.entity.ProjectEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.ProjectJpaRepository;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class IntegrationService {

    private static final Pattern SAFE_FIELD_NAME = Pattern.compile("^[a-zA-Z][a-zA-Z0-9_]{0,63}$");
    private static final Set<String> ALLOWED_STATUS_FIELDS = Set.of(
        "buildingsStatus",
        "unitsStatus"
    );

    private final ProjectJpaRepository projectJpaRepository;

    public IntegrationService(ProjectJpaRepository projectJpaRepository) {
        this.projectJpaRepository = projectJpaRepository;
    }

    @Transactional
    public void updateIntegrationStatus(UUID projectId, String field, String status) {
        String normalizedField = normalizeField(field);
        String normalizedStatus = normalizeStatus(status);

        ProjectEntity project = projectJpaRepository.findById(projectId)
            .orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));

        Map<String, Object> integrationData = project.getIntegrationData() == null
            ? new HashMap<>()
            : new HashMap<>(project.getIntegrationData());

        integrationData.put(normalizedField, normalizedStatus);
        project.setIntegrationData(integrationData);
        project.setUpdatedAt(Instant.now());

        projectJpaRepository.save(project);
    }

    private String normalizeField(String value) {
        if (value == null || value.isBlank()) {
            throw new ApiException("field is required", "VALIDATION_ERROR", null, 400);
        }
        String normalized = value.trim();
        if (!SAFE_FIELD_NAME.matcher(normalized).matches()) {
            throw new ApiException("Invalid integration field", "VALIDATION_ERROR", null, 400);
        }
        if (!ALLOWED_STATUS_FIELDS.contains(normalized)) {
            throw new ApiException("Unsupported integration field: " + normalized, "VALIDATION_ERROR", null, 400);
        }
        return normalized;
    }

    private String normalizeStatus(String value) {
        if (value == null || value.isBlank()) {
            throw new ApiException("status is required", "VALIDATION_ERROR", null, 400);
        }
        return value.trim();
    }
}
