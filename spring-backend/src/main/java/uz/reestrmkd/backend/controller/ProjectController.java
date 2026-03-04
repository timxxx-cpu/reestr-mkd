package uz.reestrmkd.backend.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.*;
import uz.reestrmkd.backend.entity.ApplicationEntity;
import uz.reestrmkd.backend.entity.ProjectEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.service.ValidationUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
public class ProjectController {
    private final ProjectJpaRepository projectRepo;
    private final ApplicationJpaRepository applicationRepo;
    private final JdbcTemplate jdbcTemplate;

    public ProjectController(ProjectJpaRepository projectRepo, ApplicationJpaRepository applicationRepo, JdbcTemplate jdbcTemplate) {
        this.projectRepo = projectRepo;
        this.applicationRepo = applicationRepo;
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/projects/from-application")
    public CreateProjectFromApplicationResponseDto createFromApplication(@Valid @RequestBody CreateProjectFromApplicationRequestDto body) {
        UUID applicationId = body.applicationId();
        ApplicationEntity app = applicationRepo.findById(applicationId).orElseThrow(() -> new ApiException("Application not found", "NOT_FOUND", null, 404));
        ProjectEntity p = new ProjectEntity();
        p.setId(UUID.randomUUID());
        p.setScopeId(app.getScopeId());
        p.setName(body.name() == null || body.name().isBlank() ? "Проект" : body.name());
        p.setAddress(body.address() == null ? "" : body.address());
        p.setCreatedAt(Instant.now());
        p.setUpdatedAt(Instant.now());
        projectRepo.save(p);
        app.setProjectId(p.getId());
        app.setUpdatedAt(Instant.now());
        applicationRepo.save(app);
        return new CreateProjectFromApplicationResponseDto(true, p.getId());
    }

    @GetMapping("/projects")
    public PagedItemsResponseDto getProjects(
        @RequestParam(required = false) String scope,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String workflowSubstatus,
        @RequestParam(required = false) String assignee,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer limit
    ) {
        if (scope == null || scope.isBlank()) {
            throw new ApiException("Scope is required", "MISSING_SCOPE", null, 400);
        }

        ActorPrincipal actor = resolveActor();
        List<String> statusValues = parseCsv(status);
        List<String> workflowValues = parseCsv(workflowSubstatus);

        int p = Math.max(1, page == null ? 1 : page);
        int l = Math.min(100, Math.max(1, limit == null ? 1000 : limit));

        StringBuilder appSql = new StringBuilder("select * from applications where scope_id=?");
        List<Object> args = new ArrayList<>();
        args.add(scope);

        if (statusValues.size() == 1) {
            appSql.append(" and status=?");
            args.add(statusValues.getFirst());
        } else if (statusValues.size() > 1) {
            appSql.append(" and status in (").append(String.join(",", Collections.nCopies(statusValues.size(), "?"))).append(")");
            args.addAll(statusValues);
        }

        if (workflowValues.size() == 1) {
            appSql.append(" and workflow_substatus=?");
            args.add(workflowValues.getFirst());
        } else if (workflowValues.size() > 1) {
            appSql.append(" and workflow_substatus in (").append(String.join(",", Collections.nCopies(workflowValues.size(), "?"))).append(")");
            args.addAll(workflowValues);
        }

        if (assignee != null && !assignee.isBlank()) {
            if ("mine".equals(assignee)) {
                if (actor == null || actor.userId() == null || actor.userId().isBlank()) {
                    throw new ApiException("Auth context required for assignee=mine", "UNAUTHORIZED", null, 401);
                }
                appSql.append(" and assignee_name=?");
                args.add(actor.userId());
            } else if (!"all".equals(assignee)) {
                appSql.append(" and assignee_name=?");
                args.add(assignee);
            }
        }

        appSql.append(" order by updated_at desc");
        List<Map<String, Object>> apps = jdbcTemplate.queryForList(appSql.toString(), args.toArray());

        List<Map<String, Object>> filteredApps = new ArrayList<>(apps);
        String searchTrimmed = search == null ? null : search.trim();
        if (searchTrimmed != null && !searchTrimmed.isBlank()) {
            String lower = searchTrimmed.toLowerCase(Locale.ROOT);
            filteredApps = filteredApps.stream().filter(app ->
                lowerContains(app.get("internal_number"), lower) ||
                    lowerContains(app.get("external_id"), lower) ||
                    lowerContains(app.get("applicant"), lower) ||
                    lowerContains(app.get("assignee_name"), lower)
            ).toList();
        }

        List<UUID> projectIds = filteredApps.stream()
            .map(app -> app.get("project_id"))
            .filter(Objects::nonNull)
            .map(v -> UUID.fromString(String.valueOf(v)))
            .distinct()
            .toList();
        if (projectIds.isEmpty()) {
            return new PagedItemsResponseDto(List.of(), p, l, 0, 0);
        }

        StringBuilder projectSql = new StringBuilder("""
            select p.id, p.uj_code, p.cadastre_number, p.name, p.region, p.address, p.address_id, p.construction_status, p.updated_at, p.created_at,
                   (select count(*) from buildings b where b.project_id=p.id) as buildings_count
            from projects p
            where p.scope_id=? and p.id in (
            """);
        projectSql.append(String.join(",", Collections.nCopies(projectIds.size(), "?"))).append(") order by p.updated_at desc");

        List<Object> projectArgs = new ArrayList<>();
        projectArgs.add(scope);
        projectArgs.addAll(projectIds);
        List<Map<String, Object>> projects = jdbcTemplate.queryForList(projectSql.toString(), projectArgs.toArray());

        Map<String, Map<String, Object>> appByProject = new HashMap<>();
        for (Map<String, Object> app : filteredApps) {
            String pid = String.valueOf(app.get("project_id"));
            appByProject.putIfAbsent(pid, app);
        }

        List<Map<String, Object>> mapped = new ArrayList<>();
        for (Map<String, Object> project : projects) {
            Map<String, Object> app = appByProject.get(String.valueOf(project.get("id")));
            int buildingsCount = ((Number) project.getOrDefault("buildings_count", 0)).intValue();
            Map<String, Object> applicationInfo = new HashMap<>();
            applicationInfo.put("status", app == null ? null : app.get("status"));
            applicationInfo.put("workflowSubstatus", app == null || app.get("workflow_substatus") == null ? "DRAFT" : app.get("workflow_substatus"));
            applicationInfo.put("internalNumber", app == null ? null : app.get("internal_number"));
            applicationInfo.put("externalSource", app == null ? null : app.get("external_source"));
            applicationInfo.put("externalId", app == null ? null : app.get("external_id"));
            applicationInfo.put("applicant", app == null ? null : app.get("applicant"));
            applicationInfo.put("submissionDate", app == null ? null : app.get("submission_date"));
            applicationInfo.put("assigneeName", app == null ? null : app.get("assignee_name"));
            applicationInfo.put("currentStage", app == null ? null : app.get("current_stage"));
            applicationInfo.put("currentStepIndex", app == null ? null : app.get("current_step"));
            applicationInfo.put("rejectionReason", null);
            applicationInfo.put("requestedDeclineReason", app == null ? null : app.get("requested_decline_reason"));
            applicationInfo.put("requestedDeclineStep", app == null ? null : app.get("requested_decline_step"));
            applicationInfo.put("requestedDeclineBy", app == null ? null : app.get("requested_decline_by"));
            applicationInfo.put("requestedDeclineAt", app == null ? null : app.get("requested_decline_at"));

            Map<String, Object> dto = new HashMap<>();
            dto.put("id", project.get("id"));
            dto.put("ujCode", project.get("uj_code"));
            dto.put("cadastre", project.get("cadastre_number"));
            dto.put("applicationId", app == null ? null : app.get("id"));
            dto.put("name", project.get("name") == null ? "Без названия" : project.get("name"));
            dto.put("status", normalizeProjectStatusFromDb(project.get("construction_status")));
            dto.put("lastModified", app == null ? project.get("updated_at") : app.get("updated_at"));
            dto.put("applicationInfo", applicationInfo);
            dto.put("complexInfo", Map.of(
                "name", project.get("name"),
                "region", project.get("region"),
                "street", project.get("address"),
                "addressId", project.get("address_id")
            ));
            dto.put("composition", Collections.nCopies(Math.max(0, buildingsCount), 1));
            dto.put("availableActions", buildProjectAvailableActions(actor, dto));
            mapped.add(dto);
        }

        if (search != null && !search.isBlank()) {
            String lower = search.toLowerCase(Locale.ROOT);
            mapped = mapped.stream().filter(pj ->
                lowerContains(pj.get("name"), lower) ||
                    lowerContains(pj.get("ujCode"), lower) ||
                    lowerContains(((Map<String, Object>) pj.get("applicationInfo")).get("internalNumber"), lower) ||
                    lowerContains(((Map<String, Object>) pj.get("applicationInfo")).get("externalId"), lower) ||
                    lowerContains(((Map<String, Object>) pj.get("complexInfo")).get("street"), lower) ||
                    lowerContains(((Map<String, Object>) pj.get("applicationInfo")).get("assigneeName"), lower)
            ).toList();
        }

        mapped.sort((a, b) -> {
            Instant ai = parseInstant(a.get("lastModified"));
            Instant bi = parseInstant(b.get("lastModified"));
            return bi.compareTo(ai);
        });

        int total = mapped.size();
        int from = Math.max(0, (p - 1) * l);
        int to = Math.min(total, from + l);
        List<Map<String, Object>> paged = from >= total ? List.of() : mapped.subList(from, to);
        return new PagedItemsResponseDto(paged, p, l, total, total > 0 ? (int) Math.ceil((double) total / l) : 0);
    }


    @GetMapping("/projects/{projectId}/tep-summary")
    public TepSummaryResponseDto getTepSummary(@PathVariable UUID projectId) {
        BigDecimal totalAreaProj = normalizeScale(jdbcTemplate.queryForObject(
            """
                select coalesce(sum(f.area_proj), 0)
                from floors f
                join building_blocks bb on bb.id = f.block_id
                join buildings b on b.id = bb.building_id
                where b.project_id = ?
            """,
            BigDecimal.class,
            projectId
        ));

        BigDecimal totalAreaFact = normalizeScale(jdbcTemplate.queryForObject(
            """
                select coalesce(sum(f.area_fact), 0)
                from floors f
                join building_blocks bb on bb.id = f.block_id
                join buildings b on b.id = bb.building_id
                where b.project_id = ?
            """,
            BigDecimal.class,
            projectId
        ));

        List<Map<String, Object>> units = jdbcTemplate.queryForList(
            """
                select u.unit_type, u.total_area, u.cadastre_number
                from units u
                join floors f on f.id = u.floor_id
                join building_blocks bb on bb.id = f.block_id
                join buildings b on b.id = bb.building_id
                where b.project_id = ?
            """,
            projectId
        );

        BigDecimal livingArea = BigDecimal.ZERO;
        int livingCount = 0;
        BigDecimal commercialArea = BigDecimal.ZERO;
        int commercialCount = 0;
        BigDecimal infrastructureArea = BigDecimal.ZERO;
        int infrastructureCount = 0;
        BigDecimal parkingArea = BigDecimal.ZERO;
        int parkingCount = 0;
        int cadastreReadyCount = 0;

        for (Map<String, Object> unit : units) {
            String unitType = String.valueOf(unit.getOrDefault("unit_type", "")).trim();
            BigDecimal area = toBigDecimal(unit.get("total_area"));
            if (unit.get("cadastre_number") != null && !String.valueOf(unit.get("cadastre_number")).isBlank()) {
                cadastreReadyCount += 1;
            }

            if (isLivingType(unitType)) {
                livingArea = livingArea.add(area);
                livingCount += 1;
            } else if (isCommercialType(unitType)) {
                commercialArea = commercialArea.add(area);
                commercialCount += 1;
            } else if (isParkingType(unitType)) {
                parkingArea = parkingArea.add(area);
                parkingCount += 1;
            } else {
                infrastructureArea = infrastructureArea.add(area);
                infrastructureCount += 1;
            }
        }

        BigDecimal mopArea = normalizeScale(jdbcTemplate.queryForObject(
            """
                select coalesce(sum(ca.area), 0)
                from common_areas ca
                join floors f on f.id = ca.floor_id
                join building_blocks bb on bb.id = f.block_id
                join buildings b on b.id = bb.building_id
                where b.project_id = ?
            """,
            BigDecimal.class,
            projectId
        ));

        List<Map<String, Object>> buildings = jdbcTemplate.queryForList(
            "select date_start, date_end from buildings where project_id = ?",
            projectId
        );
        BigDecimal progressSum = BigDecimal.ZERO;
        for (Map<String, Object> building : buildings) {
            progressSum = progressSum.add(calcProgress(building.get("date_start"), building.get("date_end")));
        }
        BigDecimal avgProgress = buildings.isEmpty()
            ? BigDecimal.ZERO
            : progressSum.divide(BigDecimal.valueOf(buildings.size()), 2, RoundingMode.HALF_UP);

        return new TepSummaryResponseDto(
            totalAreaProj,
            totalAreaFact,
            new TepSummaryMetricDto(normalizeScale(livingArea), livingCount),
            new TepSummaryMetricDto(normalizeScale(commercialArea), commercialCount),
            new TepSummaryMetricDto(normalizeScale(infrastructureArea), infrastructureCount),
            new TepSummaryMetricDto(normalizeScale(parkingArea), parkingCount),
            new TepSummaryMopDto(mopArea),
            cadastreReadyCount,
            units.size(),
            normalizeScale(avgProgress)
        );
    }


    private boolean isLivingType(String type) {
        return Set.of("flat", "duplex_up", "duplex_down").contains(type);
    }

    private boolean isCommercialType(String type) {
        return Set.of("office", "office_inventory", "non_res_block").contains(type);
    }

    private boolean isParkingType(String type) {
        return "parking_place".equals(type);
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) return BigDecimal.ZERO;
        if (value instanceof BigDecimal bd) return bd;
        if (value instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (Exception ignored) {
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal normalizeScale(BigDecimal value) {
        BigDecimal raw = value == null ? BigDecimal.ZERO : value;
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calcProgress(Object dateStart, Object dateEnd) {
        Instant start = parseInstant(dateStart);
        if (start == null) return BigDecimal.ZERO;
        Instant end = parseInstant(dateEnd);
        if (end != null && !end.isBefore(start)) return BigDecimal.valueOf(100);

        long totalDays = 365;
        long elapsedDays = Math.max(0, (Instant.now().toEpochMilli() - start.toEpochMilli()) / (1000L * 60L * 60L * 24L));
        BigDecimal progress = BigDecimal.valueOf(elapsedDays)
            .multiply(BigDecimal.valueOf(100))
            .divide(BigDecimal.valueOf(totalDays), 2, RoundingMode.HALF_UP);
        if (progress.compareTo(BigDecimal.valueOf(100)) > 0) return BigDecimal.valueOf(100);
        if (progress.compareTo(BigDecimal.ZERO) < 0) return BigDecimal.ZERO;
        return progress;
    }

    private List<String> parseCsv(String value) {
        if (value == null || value.isBlank()) return List.of();
        return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
    }

    private String normalizeProjectStatusFromDb(Object value) {
        String status = value == null ? null : String.valueOf(value);
        if ("project".equals(status)) return "Проектный";
        if ("construction".equals(status)) return "Строящийся";
        if ("completed".equals(status)) return "Сдан в эксплуатацию";
        return status == null ? "Проектный" : status;
    }

    private ActorPrincipal resolveActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof ActorPrincipal actor) return actor;
        return null;
    }

    private boolean lowerContains(Object value, String lower) {
        return String.valueOf(value == null ? "" : value).toLowerCase(Locale.ROOT).contains(lower);
    }

    private Instant parseInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value == null) return Instant.EPOCH;
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception e) {
            return Instant.EPOCH;
        }
    }

    private int toInt(Object value, int fallback) {
        if (value == null) return fallback;
        if (value instanceof Number number) return number.intValue();
        return Integer.parseInt(String.valueOf(value));
    }

    private List<String> buildProjectAvailableActions(ActorPrincipal actor, Map<String, Object> projectDto) {
        Map<String, Object> app = (Map<String, Object>) projectDto.getOrDefault("applicationInfo", Map.of());
        String status = app.get("status") == null ? null : String.valueOf(app.get("status"));
        String substatus = app.get("workflowSubstatus") == null ? null : String.valueOf(app.get("workflowSubstatus"));
        boolean isCompleted = "COMPLETED".equals(status);
        boolean isDeclined = "DECLINED".equals(status);
        boolean isPendingDecline = "PENDING_DECLINE".equals(substatus);

        String role = actor == null ? null : actor.userRole();
        String userId = actor == null ? null : actor.userId();

        boolean isAdmin = "admin".equals(role);
        boolean isBranchManager = "branch_manager".equals(role);
        boolean isTechnician = "technician".equals(role);
        boolean isController = "controller".equals(role);
        boolean isAssigned = app.get("assigneeName") == null || Objects.equals(String.valueOf(app.get("assigneeName")), userId);

        List<String> actions = new ArrayList<>();
        actions.add("view");
        if (!isCompleted && !isDeclined && (isAdmin || isBranchManager)) actions.add("reassign");
        if (isAdmin) actions.add("delete");
        if ((isAdmin || isBranchManager || isController) && !isCompleted) actions.add("decline");
        if (isPendingDecline && (isAdmin || isBranchManager)) actions.add("return_from_decline");

        boolean canTechnicianEdit = isTechnician && isAssigned && Set.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER", "INTEGRATION").contains(substatus);
        boolean canControllerEdit = isController && "REVIEW".equals(substatus);
        if (!isCompleted && !isDeclined && (canTechnicianEdit || canControllerEdit || isAdmin)) actions.add("edit");
        return actions.stream().distinct().collect(Collectors.toList());
    }

    @GetMapping("/projects/map-overview")
    public ItemsResponseDto mapOverview(@RequestParam(required = false) String scope) {
        String sql = "select id, name, address, land_plot_geojson from projects" + ((scope != null && !scope.isBlank()) ? " where scope_id = ?" : "");
        List<Map<String, Object>> rows = (scope != null && !scope.isBlank()) ? jdbcTemplate.queryForList(sql, scope) : jdbcTemplate.queryForList(sql);
        return new ItemsResponseDto(rows);
    }

    @GetMapping("/projects/summary-counts")
    public SummaryCountsResponseDto summaryCounts(@RequestParam(required = false) String scope, @RequestParam(required = false) String assignee) {
        StringBuilder sql = new StringBuilder("select count(*) as total, count(*) filter (where a.status='IN_PROGRESS') as in_progress, count(*) filter (where a.status='COMPLETED') as completed, count(*) filter (where a.status='DECLINED') as declined from projects p left join applications a on a.project_id=p.id where 1=1");
        List<Object> args = new ArrayList<>();
        if (scope != null && !scope.isBlank()) { sql.append(" and p.scope_id = ?"); args.add(scope); }
        if (assignee != null && !assignee.isBlank()) { sql.append(" and a.assignee_name = ?"); args.add(assignee); }
        Map<String, Object> row = jdbcTemplate.queryForMap(sql.toString(), args.toArray());
        return new SummaryCountsResponseDto(toInt(row.get("total"), 0), toInt(row.get("in_progress"), 0), toInt(row.get("completed"), 0), toInt(row.get("declined"), 0));
    }

    @GetMapping("/external-applications")
    public ItemsResponseDto externalApplications(@RequestParam(required = false) String scope) {
        String sql = "select * from applications where external_source is not null" + ((scope != null && !scope.isBlank()) ? " and scope_id = ?" : "") + " order by submission_date desc";
        List<Map<String, Object>> rows = (scope != null && !scope.isBlank()) ? jdbcTemplate.queryForList(sql, scope) : jdbcTemplate.queryForList(sql);
        return new ItemsResponseDto(rows);
    }

    @GetMapping("/projects/{projectId}/application-id")
    public ApplicationIdResponseDto resolveApplicationId(@PathVariable UUID projectId, @RequestParam(required = false) String scope) {
        String sql = "select id from applications where project_id = ?" + ((scope != null && !scope.isBlank()) ? " and scope_id = ?" : "") + " order by created_at desc limit 1";
        List<Map<String, Object>> rows = (scope != null && !scope.isBlank()) ? jdbcTemplate.queryForList(sql, projectId, scope) : jdbcTemplate.queryForList(sql, projectId);
        return new ApplicationIdResponseDto(rows.isEmpty() ? null : rows.getFirst().get("id"));
    }

    @PostMapping("/projects/{projectId}/validation/step")
    public ValidationStepResponseDto validateStep(@PathVariable UUID projectId, @Valid @RequestBody ValidationStepRequestDto body) {
        ValidationUtils.ValidationResult validationResult = ValidationUtils.buildStepValidationResult(jdbcTemplate, projectId, body.stepId());
        List<ValidationErrorItemDto> errors = validationResult.errors().stream()
            .map(err -> new ValidationErrorItemDto(err.code(), err.title(), err.message()))
            .toList();

        return new ValidationStepResponseDto(errors.isEmpty(), projectId, body.scope(), body.stepId(), errors);
    }
}
