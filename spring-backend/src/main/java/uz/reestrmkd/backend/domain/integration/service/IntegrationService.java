package uz.reestrmkd.backend.domain.integration.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.common.service.FormatUtils;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.LinkedHashMap;
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

    private final ApplicationJpaRepository applicationJpaRepository;
    private final BuildingJpaRepository buildingJpaRepository;
    private final UnitJpaRepository unitJpaRepository;

    public IntegrationService(
        ApplicationJpaRepository applicationJpaRepository,
        BuildingJpaRepository buildingJpaRepository,
        UnitJpaRepository unitJpaRepository
    ) {
        this.applicationJpaRepository = applicationJpaRepository;
        this.buildingJpaRepository = buildingJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getLatestIntegrationStatus(UUID projectId) {
        return applicationJpaRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)
            .map(ApplicationEntity::getIntegrationData)
            .map(LinkedHashMap::new)
            .orElseGet(LinkedHashMap::new);
    }

    @Transactional
    public Map<String, Object> updateLatestIntegrationStatus(UUID projectId, String field, Object status) {
        String normalizedField = normalizeField(field);
        ApplicationEntity application = applicationJpaRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)
            .orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));

        Map<String, Object> integrationData = application.getIntegrationData() == null
            ? new LinkedHashMap<>()
            : new LinkedHashMap<>(application.getIntegrationData());

        integrationData.put(normalizedField, status);
        application.setIntegrationData(integrationData);
        application.setUpdatedAt(Instant.now());
        applicationJpaRepository.save(application);
        return integrationData;
    }

    @Transactional
    public String updateBuildingCadastre(UUID buildingId, String cadastreRaw) {
        String cadastre = FormatUtils.formatBuildingCadastre(cadastreRaw);
        int updated = buildingJpaRepository.updateCadastreNumber(buildingId, cadastre, Instant.now());
        if (updated == 0) {
            throw new ApiException("Building not found", "NOT_FOUND", null, 404);
        }
        return cadastre;
    }

    @Transactional
    public String updateUnitCadastre(UUID unitId, String cadastreRaw) {
        String cadastre = normalizeUnitCadastre(cadastreRaw);
        int updated = unitJpaRepository.updateCadastreNumber(unitId, cadastre, Instant.now());
        if (updated == 0) {
            throw new ApiException("Unit not found", "NOT_FOUND", null, 404);
        }
        return cadastre;
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

    private String normalizeUnitCadastre(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
