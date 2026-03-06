package uz.reestrmkd.backend.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.*;
import uz.reestrmkd.backend.exception.ApiException;
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
    private final JdbcTemplate jdbcTemplate;

    public ProjectController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostMapping("/projects/from-application")
    public MapResponseDto createFromApplication(@RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        String scope = body.get("scope") == null ? "" : String.valueOf(body.get("scope")).trim();
        if (scope.isBlank()) {
            throw new ApiException("scope is required", "VALIDATION_ERROR", null, 400);
        }

      @SuppressWarnings("unchecked")
        Map<String, Object> appData = body.get("appData") instanceof Map<?, ?> m
            ? (Map<String, Object>) m
            : Map.of();

        String cadastre = appData.get("cadastre") == null ? null : String.valueOf(appData.get("cadastre")).trim();
        if (cadastre != null && cadastre.isBlank()) cadastre = null;

        if (cadastre != null) {
            List<Map<String, Object>> reapplication = jdbcTemplate.queryForList(
                "select a.id from applications a join projects p on p.id=a.project_id where a.scope_id=? and a.status='IN_PROGRESS' and p.cadastre_number=? limit 1",
                scope,
                cadastre
            );
            if (!reapplication.isEmpty()) {
                throw new ApiException(
                    "Отказ в принятии: по данному ЖК уже есть активное заявление в работе. Повторная подача отклонена.",
                    "REAPPLICATION_BLOCKED",
                    null,
                    409
                );
            }
        }

        String ujCode = generateNextProjectCode(scope);
        UUID projectId = UUID.randomUUID();
        String applicant = appData.get("applicant") == null ? null : String.valueOf(appData.get("applicant"));
        String address = appData.get("address") == null ? null : String.valueOf(appData.get("address"));
        String projectName = applicant == null || applicant.isBlank() ? "Новый проект" : "ЖК от " + applicant;

        jdbcTemplate.update(
            "insert into projects(id, scope_id, uj_code, name, address, cadastre_number, construction_status, created_at, updated_at) values (?,?,?,?,?,?,?,now(),now())",
            projectId,
            scope,
            ujCode,
            projectName,
            address,
            cadastre,
            "Проектный"
        );

        ActorPrincipal actor = resolveActor();
        String assignee = actor == null ? null : actor.userId();
        UUID applicationId = UUID.randomUUID();
        String internalNumber = "INT-" + String.valueOf(System.currentTimeMillis()).substring(7);

        // ИСПРАВЛЕНИЕ: Безопасный парсинг даты и приведение к java.sql.Timestamp и строк
        Object rawSubDate = appData.get("submissionDate");
        Instant subInstant = rawSubDate == null ? Instant.now() : parseInstant(rawSubDate);
        if (subInstant == null || subInstant.equals(Instant.EPOCH)) {
            subInstant = Instant.now();
        }
        
        String externalSource = appData.get("source") == null ? null : String.valueOf(appData.get("source"));
        String externalId = appData.get("externalId") == null ? null : String.valueOf(appData.get("externalId"));

        jdbcTemplate.update(
            "insert into applications(id, project_id, scope_id, internal_number, external_source, external_id, applicant, submission_date, assignee_name, status, workflow_substatus, current_step, current_stage, created_at, updated_at) " +
                "values (?,?,?,?,?,?,?,?,?,?,?,?,?,now(),now())",
            applicationId,
            projectId,
            scope,
            internalNumber,
            externalSource,
            externalId,
            applicant,
            java.sql.Timestamp.from(subInstant), // Явно передаем JDBC-совместимый Timestamp
            assignee,
            "IN_PROGRESS",
            "DRAFT",
            0,
            1
        );

        return MapResponseDto.of(Map.of(
            "ok", true,
            "projectId", projectId,
            "applicationId", applicationId,
            "ujCode", ujCode
        ));
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
            appSql.append(" and status in (").append(repeatParams(statusValues.size())).append(")");
            args.addAll(statusValues);
        }

        if (workflowValues.size() == 1) {
            appSql.append(" and workflow_substatus=?");
            args.add(workflowValues.getFirst());
        } else if (workflowValues.size() > 1) {
            appSql.append(" and workflow_substatus in (").append(repeatParams(workflowValues.size())).append(")");
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
            ).collect(Collectors.toList()); // Используем Collectors.toList() чтобы список оставался изменяемым
        }

        List<UUID> projectIds = filteredApps.stream()
            .map(app -> app.get("project_id"))
            .filter(Objects::nonNull)
            .map(v -> UUID.fromString(String.valueOf(v)))
            .distinct()
            .collect(Collectors.toList());
            
        if (projectIds.isEmpty()) {
            return new PagedItemsResponseDto(List.of(), p, l, 0, 0);
        }

        StringBuilder projectSql = new StringBuilder("""
            select p.id, p.uj_code, p.cadastre_number, p.name, p.region, p.address, p.address_id, p.construction_status, p.updated_at, p.created_at,
                   (select count(*) from buildings b where b.project_id=p.id) as buildings_count
            from projects p
            where p.scope_id=? and p.id in (
            """);
        projectSql.append(repeatParams(projectIds.size())).append(") order by p.updated_at desc");

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

            // ИСПРАВЛЕНИЕ 1: Используем обычный HashMap вместо Map.of для полей, которые могут быть null
            Map<String, Object> complexInfo = new HashMap<>();
            complexInfo.put("name", project.get("name"));
            complexInfo.put("region", project.get("region"));
            complexInfo.put("street", project.get("address"));
            complexInfo.put("addressId", project.get("address_id"));

            Map<String, Object> dto = new HashMap<>();
            dto.put("id", project.get("id"));
            dto.put("ujCode", project.get("uj_code"));
            dto.put("cadastre", project.get("cadastre_number"));
            dto.put("applicationId", app == null ? null : app.get("id"));
            dto.put("name", project.get("name") == null ? "Без названия" : project.get("name"));
            dto.put("status", normalizeProjectStatusFromDb(project.get("construction_status")));
            dto.put("lastModified", app == null ? project.get("updated_at") : app.get("updated_at"));
            dto.put("applicationInfo", applicationInfo);
            dto.put("complexInfo", complexInfo);
            dto.put("composition", Collections.nCopies(Math.max(0, buildingsCount), 1));
            dto.put("availableActions", buildProjectAvailableActions(actor, dto));
            mapped.add(dto);
        }

      if (search != null && !search.isBlank()) {
            String lower = search.toLowerCase(Locale.ROOT);
            mapped = mapped.stream().filter(pj -> {
                @SuppressWarnings("unchecked")
                Map<String, Object> appInfo = (Map<String, Object>) pj.get("applicationInfo");
                @SuppressWarnings("unchecked")
                Map<String, Object> compInfo = (Map<String, Object>) pj.get("complexInfo");

                return lowerContains(pj.get("name"), lower) ||
                    lowerContains(pj.get("ujCode"), lower) ||
                    (appInfo != null && (lowerContains(appInfo.get("internalNumber"), lower) ||
                                         lowerContains(appInfo.get("externalId"), lower) ||
                                         lowerContains(appInfo.get("assigneeName"), lower))) ||
                    (compInfo != null && lowerContains(compInfo.get("street"), lower));
            }).collect(Collectors.toList());
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
        if (start == null || start.equals(Instant.EPOCH)) return BigDecimal.ZERO;
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

    private String generateNextProjectCode(String scope) {
        List<String> existingCodes = jdbcTemplate.queryForList(
            "select uj_code from projects where scope_id=? and uj_code is not null order by uj_code desc",
            String.class,
            scope
        );

        int maxNumber = 0;
        for (String code : existingCodes) {
            if (code == null) continue;
            String trimmed = code.trim();
            if (!trimmed.startsWith("UJ")) continue;
            String suffix = trimmed.substring(2);
            try {
                int value = Integer.parseInt(suffix);
                if (value > maxNumber) maxNumber = value;
            } catch (Exception ignored) {
                // skip malformed code
            }
        }

        return "UJ" + String.format("%06d", maxNumber + 1);
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

    // ИСПРАВЛЕНИЕ 3: Корректно читаем java.sql.Timestamp из базы для правильной сортировки дат
    private Instant parseInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value instanceof java.sql.Timestamp ts) return ts.toInstant();
        if (value instanceof java.util.Date date) return date.toInstant();
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
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return fallback;
        }
    }

    private List<String> buildProjectAvailableActions(ActorPrincipal actor, Map<String, Object> projectDto) {
        @SuppressWarnings("unchecked")
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
    public MapResponseDto mapOverview(@RequestParam(required = false) String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ApiException("Scope is required", "MISSING_SCOPE", null, 400);
        }

        List<Map<String, Object>> projectsData = jdbcTemplate.queryForList(
            "select id, uj_code, name, address, construction_status, land_plot_geojson from projects where scope_id = ? order by updated_at desc",
            scope
        );

        List<Map<String, Object>> applicationsData = jdbcTemplate.queryForList(
            "select project_id, status from applications where scope_id = ?",
            scope
        );

        List<UUID> projectIds = projectsData.stream().map(row -> (UUID) row.get("id")).filter(Objects::nonNull).toList();
        Map<UUID, List<Map<String, Object>>> buildingsByProject = new LinkedHashMap<>();

        if (!projectIds.isEmpty()) {
            String placeholders = projectIds.stream().map(id -> "?").collect(Collectors.joining(","));
            List<Map<String, Object>> buildingsData = jdbcTemplate.queryForList(
                "select id, project_id, label, house_number, category, building_code, footprint_geojson from buildings where project_id in (" + placeholders + ")",
                projectIds.toArray()
            );

            List<UUID> buildingIds = buildingsData.stream().map(row -> (UUID) row.get("id")).filter(Objects::nonNull).toList();
            Map<UUID, List<Map<String, Object>>> blocksByBuilding = new LinkedHashMap<>();
            Map<UUID, List<Map<String, Object>>> floorsByBlock = new LinkedHashMap<>();
            Map<UUID, List<Map<String, Object>>> unitsByFloor = new LinkedHashMap<>();

            if (!buildingIds.isEmpty()) {
                String buildingPh = buildingIds.stream().map(id -> "?").collect(Collectors.joining(","));
                List<Map<String, Object>> blocksData = jdbcTemplate.queryForList(
                    "select id, building_id, label, type, floors_count, footprint_geojson, is_basement_block from building_blocks where building_id in (" + buildingPh + ")",
                    buildingIds.toArray()
                );

                List<UUID> blockIds = blocksData.stream().map(row -> (UUID) row.get("id")).filter(Objects::nonNull).toList();
                blocksByBuilding = blocksData.stream().collect(Collectors.groupingBy(row -> (UUID) row.get("building_id"), LinkedHashMap::new, Collectors.toList()));

                if (!blockIds.isEmpty()) {
                    String blockPh = blockIds.stream().map(id -> "?").collect(Collectors.joining(","));
                    List<Map<String, Object>> floorsData = jdbcTemplate.queryForList(
                        "select id, block_id from floors where block_id in (" + blockPh + ")",
                        blockIds.toArray()
                    );
                    List<UUID> floorIds = floorsData.stream().map(row -> (UUID) row.get("id")).filter(Objects::nonNull).toList();
                    floorsByBlock = floorsData.stream().collect(Collectors.groupingBy(row -> (UUID) row.get("block_id"), LinkedHashMap::new, Collectors.toList()));

                    if (!floorIds.isEmpty()) {
                        String floorPh = floorIds.stream().map(id -> "?").collect(Collectors.joining(","));
                        List<Map<String, Object>> unitsData = jdbcTemplate.queryForList(
                            "select id, floor_id, unit_type from units where floor_id in (" + floorPh + ")",
                            floorIds.toArray()
                        );
                        unitsByFloor = unitsData.stream().collect(Collectors.groupingBy(row -> (UUID) row.get("floor_id"), LinkedHashMap::new, Collectors.toList()));
                    }
                }
            }

            final Map<UUID, List<Map<String, Object>>> floorsByBlockFinal = floorsByBlock;
            final Map<UUID, List<Map<String, Object>>> unitsByFloorFinal = unitsByFloor;

            for (Map<String, Object> item : buildingsData) {
                UUID projectId = (UUID) item.get("project_id");
                UUID buildingId = (UUID) item.get("id");
                List<Map<String, Object>> buildingBlocks = blocksByBuilding.getOrDefault(buildingId, List.of());
                List<UUID> blockIds = buildingBlocks.stream().map(block -> (UUID) block.get("id")).filter(Objects::nonNull).toList();
                List<Map<String, Object>> buildingFloors = blockIds.stream().flatMap(id -> floorsByBlockFinal.getOrDefault(id, List.of()).stream()).toList();
                List<UUID> floorIds = buildingFloors.stream().map(floor -> (UUID) floor.get("id")).filter(Objects::nonNull).toList();
                List<Map<String, Object>> buildingUnits = floorIds.stream().flatMap(id -> unitsByFloorFinal.getOrDefault(id, List.of()).stream()).toList();

                Integer floorsMax = buildingBlocks.stream()
                    .map(block -> toInt(block.get("floors_count"), 0))
                    .max(Integer::compareTo)
                    .orElse(0);

                List<Map<String, Object>> blocks = buildingBlocks.stream()
                    .filter(block -> !Boolean.TRUE.equals(block.get("is_basement_block")))
                    .map(block -> {
                        Map<String, Object> b = new LinkedHashMap<>();
                        b.put("id", block.get("id"));
                        b.put("label", block.get("label"));
                        b.put("type", block.get("type"));
                        b.put("floorsCount", toInt(block.get("floors_count"), 0) == 0 ? null : toInt(block.get("floors_count"), 0));
                        b.put("geometry", block.get("footprint_geojson"));
                        return b;
                    })
                    .toList();

                Map<String, Object> building = new LinkedHashMap<>();
                building.put("id", item.get("id"));
                building.put("label", item.get("label"));
                building.put("buildingCode", item.get("building_code"));
                building.put("houseNumber", item.get("house_number"));
                building.put("house_number", item.get("house_number"));
                building.put("category", item.get("category"));
                building.put("blocksCount", blocks.size());
                building.put("floorsMax", floorsMax == 0 ? null : floorsMax);
                building.put("unitsCount", buildingUnits.size());
                building.put("apartmentsCount", buildingUnits.stream().filter(u -> "apartment".equals(String.valueOf(u.get("unit_type")))).count());
                building.put("address", item.get("house_number") == null ? null : "д. " + item.get("house_number"));
                building.put("blocks", blocks);
                building.put("geometry", item.get("footprint_geojson"));

                buildingsByProject.computeIfAbsent(projectId, k -> new ArrayList<>()).add(building);
            }
        }

        Map<UUID, String> applicationStatusByProject = new LinkedHashMap<>();
        for (Map<String, Object> app : applicationsData) {
            UUID projectId = (UUID) app.get("project_id");
            if (projectId != null && !applicationStatusByProject.containsKey(projectId)) {
                applicationStatusByProject.put(projectId, app.get("status") == null ? null : String.valueOf(app.get("status")));
            }
        }

        List<Map<String, Object>> items = projectsData.stream().map(project -> {
            UUID projectId = (UUID) project.get("id");
            List<Map<String, Object>> projectBuildings = buildingsByProject.getOrDefault(projectId, List.of());
            Map<String, Long> categoryStats = projectBuildings.stream()
                .collect(Collectors.groupingBy(b -> String.valueOf(b.getOrDefault("category", "unknown")), LinkedHashMap::new, Collectors.counting()));

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", projectId);
            result.put("ujCode", project.get("uj_code"));
            result.put("name", project.get("name"));
            result.put("address", project.get("address"));
            result.put("status", applicationStatusByProject.getOrDefault(projectId, project.get("construction_status") == null ? null : String.valueOf(project.get("construction_status"))));
            result.put("totalBuildings", projectBuildings.size());
            result.put("buildingTypeStats", categoryStats.entrySet().stream().map(e -> Map.of("category", e.getKey(), "count", e.getValue())).toList());
            result.put("landPlotGeometry", project.get("land_plot_geojson"));
            result.put("buildings", projectBuildings);
            return result;
        }).toList();

        return MapResponseDto.of(Map.of("items", items));
    }

    @GetMapping("/projects/summary-counts")
    public MapResponseDto summaryCounts(@RequestParam(required = false) String scope, @RequestParam(required = false) String assignee) {
        if (scope == null || scope.isBlank()) {
            throw new ApiException("Scope is required", "MISSING_SCOPE", null, 400);
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        ActorPrincipal actor = (authentication != null && authentication.getPrincipal() instanceof ActorPrincipal a) ? a : null;

        StringBuilder sql = new StringBuilder("select status, workflow_substatus, assignee_name from applications where scope_id = ?");
        List<Object> args = new ArrayList<>();
        args.add(scope);

        if ("mine".equals(assignee)) {
            if (actor == null || actor.userId() == null || actor.userId().isBlank()) {
                throw new ApiException("Auth context required for assignee=mine", "UNAUTHORIZED", null, 401);
            }
            sql.append(" and assignee_name = ?");
            args.add(actor.userId());
        } else if (assignee != null && !assignee.isBlank() && !"all".equals(assignee)) {
            sql.append(" and assignee_name = ?");
            args.add(assignee);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), args.toArray());
        Set<String> workSubstatuses = Set.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER");

        int work = 0, review = 0, integration = 0, pendingDecline = 0, declined = 0, registryApplications = 0, registryComplexes = 0;
        for (Map<String, Object> row : rows) {
            String status = row.get("status") == null ? null : String.valueOf(row.get("status"));
            String sub = row.get("workflow_substatus") == null ? null : String.valueOf(row.get("workflow_substatus"));
            if ("IN_PROGRESS".equals(status) && workSubstatuses.contains(sub)) work++;
            if ("REVIEW".equals(sub)) review++;
            if ("INTEGRATION".equals(sub)) integration++;
            if ("PENDING_DECLINE".equals(sub)) pendingDecline++;
            if ("DECLINED".equals(status)) declined++;
            if ("COMPLETED".equals(status) || "DECLINED".equals(status)) registryApplications++;
            if ("COMPLETED".equals(status)) registryComplexes++;
        }

        return MapResponseDto.of(Map.of(
            "work", work,
            "review", review,
            "integration", integration,
            "pendingDecline", pendingDecline,
            "declined", declined,
            "registryApplications", registryApplications,
            "registryComplexes", registryComplexes
        ));
    }

    @GetMapping("/external-applications")
    public ItemsResponseDto externalApplications(@RequestParam(required = false) String scope) {
        String sql = "select * from applications where external_source is not null" + ((scope != null && !scope.isBlank()) ? " and scope_id = ?" : "") + " order by submission_date desc";
        List<Map<String, Object>> rows = (scope != null && !scope.isBlank()) ? jdbcTemplate.queryForList(sql, scope) : jdbcTemplate.queryForList(sql);
        return new ItemsResponseDto(rows);
    }

    @GetMapping("/projects/{projectId}/application-id")
    public MapResponseDto resolveApplicationId(@PathVariable UUID projectId, @RequestParam(required = false) String scope) {
        String sql = "select id from applications where project_id = ?" + ((scope != null && !scope.isBlank()) ? " and scope_id = ?" : "") + " order by created_at desc limit 1";
        List<Map<String, Object>> rows = (scope != null && !scope.isBlank()) ? jdbcTemplate.queryForList(sql, projectId, scope) : jdbcTemplate.queryForList(sql, projectId);
        if (rows.isEmpty()) {
            throw new ApiException("Application not found", "NOT_FOUND", null, 404);
        }
        return MapResponseDto.of(Map.of("applicationId", rows.getFirst().get("id")));
    }

    @PostMapping("/projects/{projectId}/validation/step")
    public MapResponseDto validateStep(@PathVariable UUID projectId, @Valid @RequestBody ValidationStepRequestDto body) {
        String stepId = body.stepId() == null ? "" : body.stepId();
        ValidationUtils.ValidationResult validationResult = ValidationUtils.buildStepValidationResult(jdbcTemplate, projectId, stepId);
        List<Map<String, Object>> errors = validationResult.errors().stream()
            .map(err -> Map.<String, Object>of("code", err.code(), "title", err.title(), "message", err.message()))
            .toList();

        return MapResponseDto.of(Map.of("ok", errors.isEmpty(), "stepId", body.stepId(), "errors", errors));
    }
  private String repeatParams(int count) {
        if (count <= 0) return "";
        if (count == 1) return "?";
        StringBuilder sb = new StringBuilder("?");
        for (int i = 1; i < count; i++) {
            sb.append(",?");
        }
        return sb.toString();
    }
}
