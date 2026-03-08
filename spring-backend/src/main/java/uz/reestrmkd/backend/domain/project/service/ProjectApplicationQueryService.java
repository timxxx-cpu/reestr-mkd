package uz.reestrmkd.backend.domain.project.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectApplicationQueryService {

    private final ApplicationJpaRepository applicationJpaRepository;

    public ProjectApplicationQueryService(ApplicationJpaRepository applicationJpaRepository) {
        this.applicationJpaRepository = applicationJpaRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summaryCounts(String scope, String assignee, ActorPrincipal actor) {
        if (scope == null || scope.isBlank()) {
            throw new ApiException("Scope is required", "MISSING_SCOPE", null, 400);
        }

        List<ApplicationEntity> applications = resolveApplications(scope, assignee, actor);
        Set<String> workSubstatuses = Set.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER");

        int work = 0;
        int review = 0;
        int integration = 0;
        int pendingDecline = 0;
        int declined = 0;
        int registryApplications = 0;
        int registryComplexes = 0;

        for (ApplicationEntity application : applications) {
            String status = application.getStatus();
            String substatus = application.getWorkflowSubstatus();
            if ("IN_PROGRESS".equals(status) && workSubstatuses.contains(substatus)) {
                work++;
            }
            if ("REVIEW".equals(substatus)) {
                review++;
            }
            if ("INTEGRATION".equals(substatus)) {
                integration++;
            }
            if ("PENDING_DECLINE".equals(substatus)) {
                pendingDecline++;
            }
            if ("DECLINED".equals(status)) {
                declined++;
            }
            if ("COMPLETED".equals(status) || "DECLINED".equals(status)) {
                registryApplications++;
            }
            if ("COMPLETED".equals(status)) {
                registryComplexes++;
            }
        }

        return Map.of(
            "work", work,
            "review", review,
            "integration", integration,
            "pendingDecline", pendingDecline,
            "declined", declined,
            "registryApplications", registryApplications,
            "registryComplexes", registryComplexes
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> externalApplications(String scope) {
        List<ApplicationEntity> applications = (scope == null || scope.isBlank())
            ? applicationJpaRepository.findByExternalSourceIsNotNullOrderBySubmissionDateDesc()
            : applicationJpaRepository.findByExternalSourceIsNotNullAndScopeIdOrderBySubmissionDateDesc(scope);
        return applications.stream().map(this::toApplicationMap).toList();
    }

    @Transactional(readOnly = true)
    public UUID resolveApplicationId(UUID projectId, String scope) {
        return ((scope == null || scope.isBlank())
            ? applicationJpaRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)
            : applicationJpaRepository.findFirstByProjectIdAndScopeIdOrderByCreatedAtDesc(projectId, scope))
            .map(ApplicationEntity::getId)
            .orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));
    }

    private List<ApplicationEntity> resolveApplications(String scope, String assignee, ActorPrincipal actor) {
        if ("mine".equals(assignee)) {
            if (actor == null || actor.userId() == null || actor.userId().isBlank()) {
                throw new ApiException("Auth context required for assignee=mine", "UNAUTHORIZED", null, 401);
            }
            return applicationJpaRepository.findByScopeIdAndAssigneeName(scope, actor.userId());
        }
        if (assignee != null && !assignee.isBlank() && !"all".equals(assignee)) {
            return applicationJpaRepository.findByScopeIdAndAssigneeName(scope, assignee);
        }
        return applicationJpaRepository.findByScopeId(scope);
    }

    private Map<String, Object> toApplicationMap(ApplicationEntity application) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", application.getId());
        mapped.put("project_id", application.getProjectId());
        mapped.put("scope_id", application.getScopeId());
        mapped.put("internal_number", application.getInternalNumber());
        mapped.put("external_source", application.getExternalSource());
        mapped.put("external_id", application.getExternalId());
        mapped.put("applicant", application.getApplicant());
        mapped.put("submission_date", application.getSubmissionDate());
        mapped.put("assignee_name", application.getAssigneeName());
        mapped.put("status", application.getStatus());
        mapped.put("workflow_substatus", application.getWorkflowSubstatus());
        mapped.put("current_step", application.getCurrentStep());
        mapped.put("current_stage", application.getCurrentStage());
        mapped.put("integration_data", application.getIntegrationData());
        mapped.put("requested_decline_reason", application.getRequestedDeclineReason());
        mapped.put("requested_decline_step", application.getRequestedDeclineStep());
        mapped.put("requested_decline_by", application.getRequestedDeclineBy());
        mapped.put("requested_decline_at", application.getRequestedDeclineAt());
        mapped.put("created_at", application.getCreatedAt());
        mapped.put("updated_at", application.getUpdatedAt());
        return mapped;
    }
}
