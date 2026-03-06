package uz.reestrmkd.backend.service;

import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.entity.ApplicationEntity;
import uz.reestrmkd.backend.entity.ProjectEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.repository.ProjectJpaRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class ProjectService {

    private final ProjectJpaRepository projectRepo;
    private final ApplicationJpaRepository applicationRepo;

    public ProjectService(ProjectJpaRepository projectRepo, ApplicationJpaRepository applicationRepo) {
        this.projectRepo = projectRepo;
        this.applicationRepo = applicationRepo;
    }

    @Transactional
    public void mergeComplexInfo(@org.springframework.lang.NonNull UUID projectId, Map<String, Object> complexInfo) {
        ProjectEntity project = projectRepo.findById(projectId)
            .orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));

        mergeString(complexInfo.get("name"), project::setName);
        mergeString(complexInfo.get("status"), project::setConstructionStatus);
        mergeString(complexInfo.get("region"), project::setRegion);
        mergeString(complexInfo.get("district"), project::setDistrict);
        mergeString(complexInfo.get("street"), project::setAddress);
        mergeLocalDate(complexInfo.get("dateStartProject"), project::setDateStartProject);
        mergeLocalDate(complexInfo.get("dateEndProject"), project::setDateEndProject);
        mergeLocalDate(complexInfo.get("dateStartFact"), project::setDateStartFact);
        mergeLocalDate(complexInfo.get("dateEndFact"), project::setDateEndFact);


        Map<String, Object> integrationPatch = new LinkedHashMap<>();
        putIfNotBlank(integrationPatch, "region", complexInfo.get("region"));
        putIfNotBlank(integrationPatch, "district", complexInfo.get("district"));
        putIfPresentPreserve(integrationPatch, "street", complexInfo.get("street"));
        putIfNotBlank(integrationPatch, "regionSoato", complexInfo.get("regionSoato"));
        putIfNotBlank(integrationPatch, "districtSoato", complexInfo.get("districtSoato"));
        putIfNotBlank(integrationPatch, "streetId", complexInfo.get("streetId"));
        putIfNotBlank(integrationPatch, "mahallaId", complexInfo.get("mahallaId"));
        putIfNotBlank(integrationPatch, "mahalla", complexInfo.get("mahalla"));
        putIfNotBlank(integrationPatch, "buildingNo", complexInfo.get("buildingNo"));
        putIfNotBlank(integrationPatch, "landmark", complexInfo.get("landmark"));
        if (!integrationPatch.isEmpty()) {
            Map<String, Object> existing = project.getIntegrationData() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(project.getIntegrationData());
            existing.putAll(integrationPatch);
            project.setIntegrationData(existing);
        }

        UUID addressId = toNullableUuid(complexInfo.get("addressId"));
        if (addressId != null) project.setAddressId(addressId);

        project.setUpdatedAt(Instant.now());
        projectRepo.save(project);
    }

    @Transactional
    public UUID mergeApplicationInfo(UUID projectId, String scope, Map<String, Object> applicationInfo) {
        ApplicationEntity application = applicationRepo.findByProjectIdAndScopeId(projectId, scope).orElseGet(() -> {
            ApplicationEntity entity = new ApplicationEntity();
            entity.setId(UUID.randomUUID());
            entity.setProjectId(projectId);
            entity.setScopeId(scope);
            entity.setInternalNumber("AUTO-" + String.valueOf(System.currentTimeMillis()).substring(7));
            entity.setExternalSource("MIGRATION_FIX");
            entity.setSubmissionDate(Instant.now());
            entity.setStatus("IN_PROGRESS");
            entity.setWorkflowSubstatus("DRAFT");
            entity.setCurrentStep(0);
            entity.setCurrentStage(1);
            entity.setCreatedAt(Instant.now());
            return entity;
        });

        mergeString(applicationInfo.get("status"), application::setStatus);
        mergeInt(applicationInfo.get("currentStepIndex"), application::setCurrentStep);
        mergeInt(applicationInfo.get("currentStage"), application::setCurrentStage);
        mergeString(applicationInfo.get("workflowSubstatus"), application::setWorkflowSubstatus);
        mergeString(applicationInfo.get("requestedDeclineReason"), application::setRequestedDeclineReason);
        mergeInt(applicationInfo.get("requestedDeclineStep"), application::setRequestedDeclineStep);
        mergeString(applicationInfo.get("requestedDeclineBy"), application::setRequestedDeclineBy);

        Instant declineAt = parseInstant(applicationInfo.get("requestedDeclineAt"));
        if (declineAt != null) application.setRequestedDeclineAt(declineAt);

        application.setUpdatedAt(Instant.now());
        return applicationRepo.save(application).getId();
    }

    private void putIfPresentPreserve(Map<String, Object> target, String key, Object value) {
        if (value == null) return;
        String parsed = String.valueOf(value);
        if (parsed.isBlank()) return;
        target.put(key, parsed);
    }

    private void putIfNotBlank(Map<String, Object> target, String key, Object value) {
        if (value == null) return;
        String parsed = String.valueOf(value).trim();
        if (parsed.isBlank()) return;
        target.put(key, parsed);
    }

    private void mergeString(Object value, java.util.function.Consumer<String> setter) {
        if (value == null) return;
        String parsed = String.valueOf(value);
        if (parsed.isBlank()) return;
        setter.accept(parsed);
    }

    private void mergeInt(Object value, java.util.function.Consumer<Integer> setter) {
        Integer parsed = toNullableInt(value);
        if (parsed != null) setter.accept(parsed);
    }

    private void mergeLocalDate(Object value, java.util.function.Consumer<LocalDate> setter) {
        LocalDate parsed = toNullableLocalDate(value);
        if (parsed != null) setter.accept(parsed);
    }

    private Integer toNullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        String s = String.valueOf(value);
        if (s.isBlank()) return null;
        return Integer.parseInt(s);
    }

    private LocalDate toNullableLocalDate(Object value) {
        if (value == null) return null;
        if (value instanceof LocalDate d) return d;
        String s = String.valueOf(value);
        if (s.isBlank()) return null;
        return LocalDate.parse(s);
    }

    private UUID toNullableUuid(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value);
        if (s.isBlank()) return null;
        return UUID.fromString(s);
    }

    private Instant parseInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        String s = String.valueOf(value);
        if (s.isBlank()) return null;
        return Instant.parse(s);
    }
}
