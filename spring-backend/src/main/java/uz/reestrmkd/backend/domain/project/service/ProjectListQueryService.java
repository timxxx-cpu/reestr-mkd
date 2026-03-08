package uz.reestrmkd.backend.domain.project.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.auth.model.UserRole;
import uz.reestrmkd.backend.domain.common.api.PagedItemsResponseDto;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectListQueryService {

    private final ApplicationJpaRepository applicationJpaRepository;
    private final ProjectJpaRepository projectJpaRepository;

    public ProjectListQueryService(
        ApplicationJpaRepository applicationJpaRepository,
        ProjectJpaRepository projectJpaRepository
    ) {
        this.applicationJpaRepository = applicationJpaRepository;
        this.projectJpaRepository = projectJpaRepository;
    }

    @Transactional(readOnly = true)
    public PagedItemsResponseDto getProjects(
        String scope,
        String status,
        String workflowSubstatus,
        String assignee,
        String search,
        Integer page,
        Integer limit,
        ActorPrincipal actor
    ) {
        if (scope == null || scope.isBlank()) {
            throw new ApiException("Scope is required", "MISSING_SCOPE", null, 400);
        }

        List<String> statusValues = parseCsv(status);
        List<String> workflowValues = parseCsv(workflowSubstatus);
        int p = Math.max(1, page == null ? 1 : page);
        int l = Math.min(100, Math.max(1, limit == null ? 1000 : limit));

        List<ApplicationEntity> apps = resolveApplications(scope, assignee, actor).stream()
            .filter(app -> statusValues.isEmpty() || statusValues.contains(app.getStatus()))
            .filter(app -> workflowValues.isEmpty() || workflowValues.contains(app.getWorkflowSubstatus()))
            .toList();

        List<ApplicationEntity> filteredApps = new ArrayList<>(apps);
        String searchTrimmed = search == null ? null : search.trim();
        if (searchTrimmed != null && !searchTrimmed.isBlank()) {
            String lower = searchTrimmed.toLowerCase(Locale.ROOT);
            filteredApps = filteredApps.stream().filter(app ->
                lowerContains(app.getInternalNumber(), lower) ||
                    lowerContains(app.getExternalId(), lower) ||
                    lowerContains(app.getApplicant(), lower) ||
                    lowerContains(app.getAssigneeName(), lower)
            ).toList();
        }

        List<UUID> projectIds = filteredApps.stream()
            .map(ApplicationEntity::getProjectId)
            .filter(Objects::nonNull)
            .distinct()
            .toList();

        if (projectIds.isEmpty()) {
            return new PagedItemsResponseDto(List.of(), p, l, 0, 0);
        }

        List<ProjectJpaRepository.ProjectListRow> projects = projectJpaRepository.findProjectListRowsByScopeIdAndIdIn(scope, projectIds);

        Map<UUID, ApplicationEntity> appByProject = new HashMap<>();
        for (ApplicationEntity app : filteredApps) {
            UUID projectId = app.getProjectId();
            if (projectId != null) {
                appByProject.putIfAbsent(projectId, app);
            }
        }

        List<Map<String, Object>> mapped = new ArrayList<>();
        for (ProjectJpaRepository.ProjectListRow project : projects) {
            ApplicationEntity app = appByProject.get(project.getId());
            int buildingsCount = project.getBuildingsCount() == null ? 0 : project.getBuildingsCount().intValue();

            Map<String, Object> applicationInfo = new HashMap<>();
            applicationInfo.put("status", app == null ? null : app.getStatus());
            applicationInfo.put("workflowSubstatus", app == null || app.getWorkflowSubstatus() == null ? "DRAFT" : app.getWorkflowSubstatus());
            applicationInfo.put("internalNumber", app == null ? null : app.getInternalNumber());
            applicationInfo.put("externalSource", app == null ? null : app.getExternalSource());
            applicationInfo.put("externalId", app == null ? null : app.getExternalId());
            applicationInfo.put("applicant", app == null ? null : app.getApplicant());
            applicationInfo.put("submissionDate", app == null ? null : app.getSubmissionDate());
            applicationInfo.put("assigneeName", app == null ? null : app.getAssigneeName());
            applicationInfo.put("currentStage", app == null ? null : app.getCurrentStage());
            applicationInfo.put("currentStepIndex", app == null ? null : app.getCurrentStep());
            applicationInfo.put("rejectionReason", null);
            applicationInfo.put("requestedDeclineReason", app == null ? null : app.getRequestedDeclineReason());
            applicationInfo.put("requestedDeclineStep", app == null ? null : app.getRequestedDeclineStep());
            applicationInfo.put("requestedDeclineBy", app == null ? null : app.getRequestedDeclineBy());
            applicationInfo.put("requestedDeclineAt", app == null ? null : app.getRequestedDeclineAt());

            Map<String, Object> complexInfo = new HashMap<>();
            complexInfo.put("name", project.getName());
            complexInfo.put("region", project.getRegion());
            complexInfo.put("street", project.getAddress());
            complexInfo.put("addressId", project.getAddressId());

            Map<String, Object> dto = new HashMap<>();
            dto.put("id", project.getId());
            dto.put("ujCode", project.getUjCode());
            dto.put("cadastre", project.getCadastreNumber());
            dto.put("applicationId", app == null ? null : app.getId());
            dto.put("name", project.getName() == null ? "Р‘РµР· РЅР°Р·РІР°РЅРёСЏ" : project.getName());
            dto.put("status", normalizeProjectStatusFromDb(project.getConstructionStatus()));
            dto.put("lastModified", app == null ? project.getUpdatedAt() : app.getUpdatedAt());
            dto.put("applicationInfo", applicationInfo);
            dto.put("complexInfo", complexInfo);
            dto.put("composition", Collections.nCopies(Math.max(0, buildingsCount), 1));
            dto.put("availableActions", buildProjectAvailableActions(actor, dto));
            mapped.add(dto);
        }

        if (search != null && !search.isBlank()) {
            String lower = search.toLowerCase(Locale.ROOT);
            mapped = mapped.stream().filter(project -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> appInfo = (Map<String, Object>) project.get("applicationInfo");
                @SuppressWarnings("unchecked")
                Map<String, Object> compInfo = (Map<String, Object>) project.get("complexInfo");

                return lowerContains(project.get("name"), lower) ||
                    lowerContains(project.get("ujCode"), lower) ||
                    (appInfo != null && (lowerContains(appInfo.get("internalNumber"), lower) ||
                        lowerContains(appInfo.get("externalId"), lower) ||
                        lowerContains(appInfo.get("assigneeName"), lower))) ||
                    (compInfo != null && lowerContains(compInfo.get("street"), lower));
            }).toList();
        }

        mapped.sort((left, right) -> asInstant(right.get("lastModified")).compareTo(asInstant(left.get("lastModified"))));

        int total = mapped.size();
        int from = Math.max(0, (p - 1) * l);
        int to = Math.min(total, from + l);
        List<Map<String, Object>> paged = from >= total ? List.of() : mapped.subList(from, to);
        return new PagedItemsResponseDto(paged, p, l, total, total > 0 ? (int) Math.ceil((double) total / l) : 0);
    }

    private List<ApplicationEntity> resolveApplications(String scope, String assignee, ActorPrincipal actor) {
        if (assignee != null && !assignee.isBlank()) {
            if ("mine".equals(assignee)) {
                if (actor == null || actor.userId() == null || actor.userId().isBlank()) {
                    throw new ApiException("Auth context required for assignee=mine", "UNAUTHORIZED", null, 401);
                }
                return applicationJpaRepository.findByScopeIdAndAssigneeNameOrderByUpdatedAtDesc(scope, actor.userId());
            }
            if (!"all".equals(assignee)) {
                return applicationJpaRepository.findByScopeIdAndAssigneeNameOrderByUpdatedAtDesc(scope, assignee);
            }
        }
        return applicationJpaRepository.findByScopeIdOrderByUpdatedAtDesc(scope);
    }

    private List<String> parseCsv(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(",")).map(String::trim).filter(item -> !item.isBlank()).toList();
    }

    private String normalizeProjectStatusFromDb(Object value) {
        String status = value == null ? null : String.valueOf(value);
        if ("project".equals(status)) return "РџСЂРѕРµРєС‚РЅС‹Р№";
        if ("construction".equals(status)) return "РЎС‚СЂРѕСЏС‰РёР№СЃСЏ";
        if ("completed".equals(status)) return "РЎРґР°РЅ РІ СЌРєСЃРїР»СѓР°С‚Р°С†РёСЋ";
        return status == null ? "РџСЂРѕРµРєС‚РЅС‹Р№" : status;
    }

    private boolean lowerContains(Object value, String lower) {
        return String.valueOf(value == null ? "" : value).toLowerCase(Locale.ROOT).contains(lower);
    }

    private Instant asInstant(Object value) {
        return value instanceof Instant instant ? instant : Instant.EPOCH;
    }

    private List<String> buildProjectAvailableActions(ActorPrincipal actor, Map<String, Object> projectDto) {
        @SuppressWarnings("unchecked")
        Map<String, Object> app = (Map<String, Object>) projectDto.getOrDefault("applicationInfo", Map.of());
        String status = app.get("status") == null ? null : String.valueOf(app.get("status"));
        String substatus = app.get("workflowSubstatus") == null ? null : String.valueOf(app.get("workflowSubstatus"));
        boolean isCompleted = "COMPLETED".equals(status);
        boolean isDeclined = "DECLINED".equals(status);
        boolean isPendingDecline = "PENDING_DECLINE".equals(substatus);

        UserRole role = actor == null ? null : actor.role();
        String userId = actor == null ? null : actor.userId();

        boolean isAdmin = role == UserRole.ADMIN;
        boolean isBranchManager = role == UserRole.BRANCH_MANAGER;
        boolean isTechnician = role == UserRole.TECHNICIAN;
        boolean isController = role == UserRole.CONTROLLER;
        boolean isAssigned = app.get("assigneeName") == null || Objects.equals(String.valueOf(app.get("assigneeName")), userId);

        List<String> actions = new ArrayList<>();
        actions.add("view");
        if (!isCompleted && !isDeclined && (isAdmin || isBranchManager)) actions.add("reassign");
        if (isAdmin) actions.add("delete");
        if ((isAdmin || isBranchManager || isController) && !isCompleted) actions.add("decline");
        if (isPendingDecline && (isAdmin || isBranchManager)) actions.add("return_from_decline");

        boolean canTechnicianEdit = isTechnician && isAssigned && Set.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER", "INTEGRATION").contains(substatus);
        boolean canControllerEdit = (isController || isBranchManager) && "REVIEW".equals(substatus);
        if (!isCompleted && !isDeclined && (canTechnicianEdit || canControllerEdit || isAdmin)) actions.add("edit");
        return actions.stream().distinct().collect(Collectors.toList());
    }
}
