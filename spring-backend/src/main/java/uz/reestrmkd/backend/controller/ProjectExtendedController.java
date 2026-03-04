package uz.reestrmkd.backend.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.BuildingDetailsSaveRequestDto;
import uz.reestrmkd.backend.dto.GeometryCandidateImportItemDto;
import uz.reestrmkd.backend.dto.GeometryCandidateResponseDto;
import uz.reestrmkd.backend.dto.GeometryCandidatesImportRequestDto;
import uz.reestrmkd.backend.dto.ItemsResponseDto;
import uz.reestrmkd.backend.dto.MapPayloadDto;
import uz.reestrmkd.backend.dto.MapResponseDto;
import uz.reestrmkd.backend.dto.OkResponseDto;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import uz.reestrmkd.backend.dto.ProjectCadastreDataDto;
import uz.reestrmkd.backend.dto.ProjectContextResponseDto;
import uz.reestrmkd.backend.dto.ProjectPassportInfoDto;
import uz.reestrmkd.backend.dto.ProjectPassportUpdateRequestDto;
import uz.reestrmkd.backend.entity.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.entity.BuildingBlockEntity;
import uz.reestrmkd.backend.entity.BuildingEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.service.FloorGeneratorService;
import uz.reestrmkd.backend.service.BuildingService;
import uz.reestrmkd.backend.service.ProjectContextService;
import uz.reestrmkd.backend.service.ProjectService;
import uz.reestrmkd.backend.service.SecurityPolicyService;
import uz.reestrmkd.backend.service.VersionService;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
public class ProjectExtendedController {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private final ProjectContextService projectContextService;
    private final JdbcTemplate jdbcTemplate;
    private final VersionService versionService;
    private final BuildingJpaRepository buildingRepo;
    private final BuildingBlockJpaRepository blockRepo;
    private final BlockFloorMarkerJpaRepository markerRepo;
    private final FloorGeneratorService floorGeneratorService;
    private final SecurityPolicyService securityPolicyService;
    private final BuildingService buildingService;
    private final ProjectService projectService;
    private final ObjectMapper objectMapper;

    public ProjectExtendedController(
        ProjectContextService projectContextService,
        JdbcTemplate jdbcTemplate,
        VersionService versionService,
        BuildingJpaRepository buildingRepo,
        BuildingBlockJpaRepository blockRepo,
        BlockFloorMarkerJpaRepository markerRepo,
        FloorGeneratorService floorGeneratorService,
        SecurityPolicyService securityPolicyService,
        BuildingService buildingService,
        ProjectService projectService,
        ObjectMapper objectMapper
    ) {
        this.projectContextService = projectContextService;
        this.jdbcTemplate = jdbcTemplate;
        this.versionService = versionService;
        this.buildingRepo = buildingRepo;
        this.blockRepo = blockRepo;
        this.markerRepo = markerRepo;
        this.floorGeneratorService = floorGeneratorService;
        this.securityPolicyService = securityPolicyService;
        this.buildingService = buildingService;
        this.projectService = projectService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/projects/{projectId}/context")
    public ProjectContextResponseDto context(@PathVariable UUID projectId, @RequestParam String scope){ return projectContextService.getProjectContext(projectId, scope); }

    @PostMapping("/projects/{projectId}/context-building-details/save")
    public MapResponseDto saveBd(@PathVariable UUID projectId, @RequestBody(required = false) BuildingDetailsSaveRequestDto payload) {
        requirePolicy("projectExtended", "mutate", "Role cannot save building details");
        Map<String, JsonNode> detailsNodeMap = payload == null || payload.buildingDetails() == null ? Map.of() : payload.buildingDetails();
        Map<String, Object> buildingDetails = new HashMap<>();
        for (Map.Entry<String, JsonNode> entry : detailsNodeMap.entrySet()) {
            buildingDetails.put(entry.getKey(), objectMapper.convertValue(entry.getValue(), new TypeReference<Map<String, Object>>() {}));
        }
        List<BuildingEntity> buildings = buildingRepo.findByProjectIdOrderByCreatedAtAsc(projectId);
        Set<UUID> knownBuildingIds = buildings.stream().map(BuildingEntity::getId).collect(Collectors.toSet());

        for (Map.Entry<String, Object> entry : buildingDetails.entrySet()) {
            String key = entry.getKey();
            if (key.contains("_features")) continue;
            Map<String, Object> details = asMap(entry.getValue());
            String[] parts = key.split("_");
            String blockRaw = parts[parts.length - 1];
            if (blockRaw.length() != 36) continue;
            UUID blockId = UUID.fromString(blockRaw);

            Integer entrancesCount = toNullableInt(details.get("entrancesCount"));

            buildingService.mergeBlockDetails(blockId, details);

            syncEntrancesForBlock(blockId, entrancesCount == null ? 0 : entrancesCount);
            syncFloorsForBlock(blockId);
            ensureEntranceMatrixForBlock(blockId);
        }

        for (Map.Entry<String, Object> entry : buildingDetails.entrySet()) {
            String key = entry.getKey();
            if (!key.contains("_features")) continue;
            String buildingRaw = key.replace("_features", "");
            if (buildingRaw.length() != 36) continue;
            UUID buildingId = UUID.fromString(buildingRaw);
            if (!knownBuildingIds.contains(buildingId)) continue;
            Map<String, Object> details = asMap(entry.getValue());

            List<Map<String, Object>> basements = asList(details.get("basements"));
            Set<UUID> keepBasementIds = new HashSet<>();
            int idx = 1;
            for (Map<String, Object> basement : basements) {
                if (basement.get("id") == null) continue;
                UUID basementId = UUID.fromString(String.valueOf(basement.get("id")));
                keepBasementIds.add(basementId);
                int depth = normalizeBasementDepth(toNullableInt(basement.get("depth")));
                int basementEntrances = Math.min(10, Math.max(1, toNullableInt(basement.get("entrancesCount")) == null ? 1 : toNullableInt(basement.get("entrancesCount"))));
                String levelsJson = jsonbString(asMap(basement.get("parkingLevels")));
                String commJson = jsonbString(asMap(basement.get("communications")));

                jdbcTemplate.update(
                    "insert into building_blocks(id, building_id, label, type, is_basement_block, linked_block_ids, basement_depth, basement_has_parking, basement_parking_levels, basement_communications, floors_count, entrances_count, updated_at) " +
                        "values (?,?,?,?,?,?::uuid[],?,?,?::jsonb,?::jsonb,?,?,now()) " +
                        "on conflict (id) do update set label=excluded.label, linked_block_ids=excluded.linked_block_ids, basement_depth=excluded.basement_depth, basement_has_parking=excluded.basement_has_parking, basement_parking_levels=excluded.basement_parking_levels, basement_communications=excluded.basement_communications, entrances_count=excluded.entrances_count, updated_at=now()",
                    basementId,
                    buildingId,
                    "Подвал " + idx,
                    "BAS",
                    true,
                    "{}",
                    depth,
                    toBool(basement.get("hasParking")),
                    levelsJson,
                    commJson,
                    0,
                    basementEntrances
                );
                idx += 1;
            }

            List<Map<String, Object>> existing = jdbcTemplate.queryForList("select id from building_blocks where building_id=? and is_basement_block=true", buildingId);
            List<UUID> deleteIds = existing.stream()
                .map(row -> UUID.fromString(String.valueOf(row.get("id"))))
                .filter(id -> !keepBasementIds.contains(id))
                .toList();
            if (!deleteIds.isEmpty()) {
                String in = String.join(",", Collections.nCopies(deleteIds.size(), "?"));
                jdbcTemplate.update("delete from building_blocks where id in (" + in + ")", deleteIds.toArray());
            }
        }

        return MapResponseDto.of(Map.of("ok", true, "projectId", projectId));
    }

    @PostMapping("/projects/{projectId}/context-meta/save")
    public MapResponseDto saveMeta(@PathVariable UUID projectId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("projectExtended", "mutate", "Role cannot save context meta");
        String scope = String.valueOf(body.getOrDefault("scope", "")).trim();
        if (scope.isBlank()) throw new ApiException("scope is required", "VALIDATION_ERROR", null, 400);

        Map<String, Object> complexInfo = asMap(body.get("complexInfo"));
        if (!complexInfo.isEmpty()) {
            projectService.mergeComplexInfo(projectId, complexInfo);
        }

        Map<String, Object> applicationInfo = asMap(body.get("applicationInfo"));
        UUID applicationId = null;
        if (!applicationInfo.isEmpty()) {
            applicationId = projectService.mergeApplicationInfo(projectId, scope, applicationInfo);

            List<Map<String, Object>> history = asList(applicationInfo.get("history"));
            if (!history.isEmpty()) {
                Map<String, Object> last = history.get(0);
                Instant when = parseInstant(last.get("date"));
                if (when != null && (Instant.now().toEpochMilli() - when.toEpochMilli()) < 5000) {
                    jdbcTemplate.update(
                        "insert into application_history(id, application_id, action, prev_status, next_status, user_name, comment, created_at, updated_at) values (gen_random_uuid(),?,?,?,?,?,?,?,now())",
                        applicationId,
                        last.get("action"),
                        last.get("prevStatus"),
                        last.get("nextStatus") == null ? applicationInfo.get("status") : last.get("nextStatus"),
                        last.get("user"),
                        last.get("comment"),
                        when
                    );
                }
            }

            List<Integer> completedSteps = toIntList(applicationInfo.get("completedSteps"));
            for (Integer idx : completedSteps) {
                jdbcTemplate.update(
                    "insert into application_steps(id,application_id,step_index,is_completed,updated_at,created_at) values (gen_random_uuid(),?,?,true,now(),now()) " +
                        "on conflict (application_id,step_index) do update set is_completed=true, updated_at=now()",
                    applicationId,
                    idx
                );
            }
        }

        return MapResponseDto.of(Map.of("ok", true, "projectId", projectId, "applicationId", applicationId));
    }

    @PostMapping("/projects/{projectId}/step-block-statuses/save")
    public MapResponseDto saveStep(@PathVariable UUID projectId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("projectExtended", "mutate", "Role cannot save step block statuses");
        String scope = String.valueOf(body.getOrDefault("scope", "")).trim();
        Integer stepIndex = toNullableInt(body.get("stepIndex"));
        if (scope.isBlank()) throw new ApiException("scope is required", "VALIDATION_ERROR", null, 400);
        if (stepIndex == null || stepIndex < 0) throw new ApiException("stepIndex must be non-negative", "VALIDATION_ERROR", null, 400);

        List<Map<String, Object>> appRows = jdbcTemplate.queryForList(
            "select id from applications where scope_id=? and project_id=? limit 1",
            scope,
            projectId
        );
        if (appRows.isEmpty()) throw new ApiException("Application not found", "NOT_FOUND", null, 404);
        UUID appId = UUID.fromString(String.valueOf(appRows.get(0).get("id")));

        String statusesJson = jsonbString(asMap(body.get("statuses")));
        jdbcTemplate.update(
            "insert into application_steps(id,application_id,step_index,block_statuses,updated_at,created_at) values (gen_random_uuid(),?,?,?::jsonb,now(),now()) " +
                "on conflict (application_id,step_index) do update set block_statuses=excluded.block_statuses, updated_at=now()",
            appId,
            stepIndex,
            statusesJson
        );

        return MapResponseDto.of(Map.of("applicationId", appId, "stepIndex", stepIndex, "blockStatuses", asMap(body.get("statuses"))));
    }

    @GetMapping("/projects/{projectId}/context-registry-details")
    public MapResponseDto registryDetails(@PathVariable UUID projectId) {
        List<Map<String, Object>> blockRows = jdbcTemplate.queryForList(
            "select bb.id from building_blocks bb join buildings b on b.id=bb.building_id where b.project_id=?",
            projectId
        );
        List<UUID> blockIds = blockRows.stream().map(r -> UUID.fromString(String.valueOf(r.get("id")))).toList();
        if (blockIds.isEmpty()) {
            return MapResponseDto.of(Map.of("markerRows", List.of(), "floors", List.of(), "entrances", List.of(), "matrix", List.of(), "units", List.of(), "mops", List.of()));
        }
        String inBlocks = String.join(",", Collections.nCopies(blockIds.size(), "?"));
        List<Map<String, Object>> markerRows = jdbcTemplate.queryForList(
            "select block_id, marker_key, is_technical, is_commercial from block_floor_markers where block_id in (" + inBlocks + ")",
            blockIds.toArray()
        );
        List<Map<String, Object>> floors = jdbcTemplate.queryForList(
            "select id, block_id, floor_key, label, index, floor_type, height, area_proj, area_fact, is_duplex, parent_floor_index, is_commercial, is_technical, is_stylobate, is_basement, is_attic, is_loft, is_roof, basement_id from floors where block_id in (" + inBlocks + ")",
            blockIds.toArray()
        );
        List<UUID> floorIds = floors.stream().map(f -> UUID.fromString(String.valueOf(f.get("id")))).toList();

        List<Map<String, Object>> entrances = jdbcTemplate.queryForList(
            "select id, block_id, number from entrances where block_id in (" + inBlocks + ")",
            blockIds.toArray()
        );
        List<Map<String, Object>> matrix = jdbcTemplate.queryForList(
            "select floor_id, entrance_number, flats_count, commercial_count, mop_count from entrance_matrix where block_id in (" + inBlocks + ")",
            blockIds.toArray()
        );

        List<Map<String, Object>> units = List.of();
        List<Map<String, Object>> mops = List.of();
        if (!floorIds.isEmpty()) {
            String inFloors = String.join(",", Collections.nCopies(floorIds.size(), "?"));
            units = jdbcTemplate.queryForList(
                "select id, floor_id, entrance_id, number, unit_type, has_mezzanine, mezzanine_type, total_area, living_area, useful_area, rooms_count, status, cadastre_number from units where floor_id in (" + inFloors + ") order by id asc",
                floorIds.toArray()
            );
            mops = jdbcTemplate.queryForList(
                "select id, floor_id, entrance_id, type, area, height from common_areas where floor_id in (" + inFloors + ")",
                floorIds.toArray()
            );
        }

        return MapResponseDto.of(Map.of("markerRows", markerRows, "floors", floors, "entrances", entrances, "matrix", matrix, "units", units, "mops", mops));
    }

    @GetMapping("/projects/{projectId}/geometry-candidates")
    public ItemsResponseDto candidates(@PathVariable UUID projectId){
        List<GeometryCandidateResponseDto> items = jdbcTemplate.query(
            "select id, source_index, label, properties, geom_geojson, area_m2, is_selected_land_plot, assigned_building_id from project_geometry_candidates where project_id=? order by source_index asc",
            (rs, rowNum) -> new GeometryCandidateResponseDto(
                UUID.fromString(rs.getString("id")),
                (Integer) rs.getObject("source_index"),
                rs.getString("label"),
                readJsonNode(rs.getString("properties")),
                readJsonNode(rs.getString("geom_geojson")),
                rs.getBigDecimal("area_m2"),
                (Boolean) rs.getObject("is_selected_land_plot"),
                rs.getObject("assigned_building_id") == null ? null : UUID.fromString(rs.getString("assigned_building_id"))
            ),
            projectId
        );
        return new ItemsResponseDto(items);
    }

    @PostMapping("/projects/{projectId}/geometry-candidates/import")
    public MapResponseDto importCandidates(@PathVariable UUID projectId, @RequestBody(required = false) GeometryCandidatesImportRequestDto payload){
        requirePolicy("projectExtended", "mutate", "Role cannot import geometry candidates");
        List<GeometryCandidateImportItemDto> candidates = payload == null || payload.candidates() == null ? List.of() : payload.candidates();
        if (candidates.isEmpty()) throw new ApiException("Candidates payload is required", "VALIDATION_ERROR", null, 400);

        int imported = 0;
        for (GeometryCandidateImportItemDto candidate : candidates) {
            if (candidate.geometry() == null || candidate.geometry().isNull()) continue;
            List<Map<String, Object>> rows;
            try {
                rows = jdbcTemplate.queryForList(
                    "select * from upsert_project_geometry_candidate(?::uuid, ?, cast(? as text), cast(? as jsonb), cast(? as jsonb))",
                    projectId,
                    candidate.sourceIndex() == null ? 0 : candidate.sourceIndex(),
                    candidate.label(),
                    jsonbString(candidate.properties() == null ? objectMapper.createObjectNode() : candidate.properties()),
                    jsonbString(candidate.geometry())
                );
            } catch (Exception e) {
                throw new ApiException("Geometry import failed", "GEOMETRY_IMPORT_ERROR", e.getMessage(), 400);
            }
            if (!rows.isEmpty()) imported += 1;
        }
        return MapResponseDto.of(Map.of("ok", true, "imported", imported));
    }

    @PostMapping("/projects/{projectId}/land-plot/select") public OkResponseDto selectLand(@PathVariable UUID projectId,@RequestBody(required = false) MapPayloadDto payload){Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();requirePolicy("projectExtended", "mutate", "Role cannot select land plot geometry");jdbcTemplate.update("update projects set integration_data = cast(? as jsonb), updated_at=now() where id = ?",String.valueOf(body),projectId);return new OkResponseDto(true);}    
    @PostMapping("/projects/{projectId}/land-plot/unselect") public OkResponseDto unselectLand(@PathVariable UUID projectId){requirePolicy("projectExtended", "mutate", "Role cannot unselect land plot geometry");jdbcTemplate.update("update projects set integration_data = '{}'::jsonb, updated_at=now() where id = ?",projectId);return new OkResponseDto(true);}    
    @DeleteMapping("/projects/{projectId}/geometry-candidates/{candidateId}") public OkResponseDto delCandidate(@PathVariable UUID candidateId){requirePolicy("projectExtended", "mutate", "Role cannot delete geometry candidate");jdbcTemplate.update("delete from project_geometry_candidates where id = ?",candidateId);return new OkResponseDto(true);}    
    @PostMapping("/projects/{projectId}/buildings/{buildingId}/geometry/select") public OkResponseDto selectBuildingGeometry(@PathVariable UUID buildingId,@RequestBody(required = false) MapPayloadDto payload){Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();requirePolicy("projectExtended", "mutate", "Role cannot select building geometry");jdbcTemplate.update("update buildings set geometry_candidate_id = ?, updated_at=now() where id = ?",UUID.fromString(String.valueOf(body.get("candidateId"))),buildingId);return new OkResponseDto(true);}    
    @GetMapping("/projects/{projectId}/passport") public MapResponseDto passport(@PathVariable UUID projectId){return MapResponseDto.of(Map.of("project",jdbcTemplate.queryForMap("select * from projects where id = ?",projectId),"participants",jdbcTemplate.queryForList("select * from project_participants where project_id = ?",projectId),"documents",jdbcTemplate.queryForList("select * from project_documents where project_id = ?",projectId)));}    
    @PutMapping("/projects/{projectId}/passport")
    public OkResponseDto updatePassport(@PathVariable UUID projectId, @RequestBody(required = false) ProjectPassportUpdateRequestDto payload){
        requirePolicy("projectExtended", "mutate", "Role cannot update passport");
        ProjectPassportInfoDto info = payload == null ? null : payload.info();
        ProjectCadastreDataDto cadastreData = payload == null ? null : payload.cadastreData();

        Map<String, Object> complexInfoPatch = new LinkedHashMap<>();
        if (info != null) {
            putIfNotBlank(complexInfoPatch, "region", info.region());
            putIfNotBlank(complexInfoPatch, "district", info.district());
            putIfPresentPreserve(complexInfoPatch, "street", info.street());
            putIfNotBlank(complexInfoPatch, "regionSoato", info.regionSoato());
            putIfNotBlank(complexInfoPatch, "districtSoato", info.districtSoato());
            putIfNotBlank(complexInfoPatch, "streetId", info.streetId());
            putIfNotBlank(complexInfoPatch, "mahallaId", info.mahallaId());
            putIfNotBlank(complexInfoPatch, "mahalla", info.mahalla());
            putIfNotBlank(complexInfoPatch, "buildingNo", info.buildingNo());
            putIfNotBlank(complexInfoPatch, "landmark", info.landmark());
        }

        jdbcTemplate.update(
            "update projects set name=coalesce(?, name), region=coalesce(?, region), district=coalesce(?, district), address=coalesce(?, address), landmark=coalesce(?, landmark), construction_status=coalesce(?, construction_status), date_start_project=coalesce(?, date_start_project), date_end_project=coalesce(?, date_end_project), date_start_fact=coalesce(?, date_start_fact), date_end_fact=coalesce(?, date_end_fact), integration_data=coalesce(integration_data, '{}'::jsonb) || cast(? as jsonb), cadastre_number=coalesce(?, cadastre_number), land_plot_area_m2=coalesce(?, land_plot_area_m2), updated_at=now() where id=?",
            info == null ? null : info.name(),
            info == null ? null : info.region(),
            info == null ? null : info.district(),
            info == null ? null : info.street(),
            info == null ? null : info.landmark(),
            info == null || info.status() == null ? null : info.status().value(),
            info == null ? null : info.dateStartProject(),
            info == null ? null : info.dateEndProject(),
            info == null ? null : info.dateStartFact(),
            info == null ? null : info.dateEndFact(),
            jsonbString(complexInfoPatch),
            cadastreData == null ? null : cadastreData.number(),
            cadastreData == null ? null : cadastreData.area(),
            projectId
        );
        return new OkResponseDto(true);
    }    
    @PutMapping("/projects/{projectId}/participants/{role}")
    public OkResponseDto upsertParticipant(@PathVariable UUID projectId, @PathVariable String role, @RequestBody(required = false) MapPayloadDto payload){
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("projectExtended", "mutate", "Role cannot update participants");

        String normalizedRole = role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("developer", "contractor", "customer").contains(normalizedRole)) {
            throw new ApiException("Unsupported participant role", "VALIDATION_ERROR", null, 400);
        }

        jdbcTemplate.update(
            "insert into project_participants(id,project_id,role,name,inn,created_at,updated_at) values (gen_random_uuid(),?,?,?,?,now(),now()) " +
                "on conflict (project_id, role) do update set name=excluded.name, inn=excluded.inn, updated_at=now()",
            projectId,
            normalizedRole,
            body.get("name"),
            body.get("inn")
        );
        return new OkResponseDto(true);
    }    
    @PostMapping("/projects/{projectId}/documents") public OkResponseDto upsertDoc(@PathVariable UUID projectId,@RequestBody(required = false) MapPayloadDto payload){Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();requirePolicy("projectExtended", "mutate", "Role cannot update documents");jdbcTemplate.update("insert into project_documents(id,project_id,name,doc_type,doc_date,doc_number,file_url,created_at,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,now(),now())",projectId,body.get("name"),body.get("docType"),body.get("docDate"),body.get("docNumber"),body.get("fileUrl"));return new OkResponseDto(true);}    
    @DeleteMapping("/project-documents/{documentId}") public OkResponseDto delDoc(@PathVariable UUID documentId){requirePolicy("projectExtended", "mutate", "Role cannot delete documents");jdbcTemplate.update("delete from project_documents where id = ?",documentId);return new OkResponseDto(true);}    
    @DeleteMapping("/projects/{projectId}") public OkResponseDto delProject(@PathVariable UUID projectId){requirePolicy("projectExtended", "deleteProject", "Role cannot delete project");jdbcTemplate.update("delete from projects where id = ?",projectId);return new OkResponseDto(true);}    
    @GetMapping("/projects/{projectId}/full-registry") public MapResponseDto fullRegistry(@PathVariable UUID projectId){return MapResponseDto.of(Map.of("context",projectContextService.getProjectContext(projectId,"full")));}
    @GetMapping("/versions") public ItemsResponseDto versions(@RequestParam(required=false) String entityType,@RequestParam(required=false) UUID entityId){ if(entityType!=null && entityId!=null) return new ItemsResponseDto(jdbcTemplate.queryForList("select * from object_versions where entity_type=? and entity_id=? order by version_number desc",entityType,entityId)); return new ItemsResponseDto(jdbcTemplate.queryForList("select * from object_versions order by updated_at desc limit 100")); }
    @PostMapping("/versions") public MapResponseDto createVersion(@RequestBody(required = false) MapPayloadDto payload){ Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data(); return MapResponseDto.of(Map.of("result",versionService.createPendingVersionsForApplication(UUID.fromString(String.valueOf(body.get("projectId"))), UUID.fromString(String.valueOf(body.get("applicationId"))), body.get("createdBy")==null?null:String.valueOf(body.get("createdBy"))))); }
    @PostMapping("/versions/{versionId}/approve") public OkResponseDto approveVersion(@PathVariable Long versionId){jdbcTemplate.update("update object_versions set version_status='CURRENT', updated_at=now() where id=?",versionId);return new OkResponseDto(true);}    
    @PostMapping("/versions/{versionId}/decline") public OkResponseDto declineVersion(@PathVariable Long versionId){jdbcTemplate.update("update object_versions set version_status='DECLINED', updated_at=now() where id=?",versionId);return new OkResponseDto(true);}    
    @GetMapping("/versions/{versionId}/snapshot") public MapResponseDto snapshot(@PathVariable Long versionId){return MapResponseDto.of(jdbcTemplate.queryForMap("select snapshot_data from object_versions where id=?",versionId));}    
    @PostMapping("/versions/{versionId}/restore") public OkResponseDto restore(@PathVariable Long versionId){jdbcTemplate.update("update object_versions set version_status='CURRENT', updated_at=now() where id=?",versionId);return new OkResponseDto(true);}    

    private void syncEntrancesForBlock(UUID blockId, int entrancesCount) {
        List<Map<String, Object>> existing = jdbcTemplate.queryForList("select id, number from entrances where block_id=?", blockId);
        Set<Integer> numbers = existing.stream().map(r -> ((Number) r.get("number")).intValue()).collect(Collectors.toSet());
        for (int i = 1; i <= Math.max(0, entrancesCount); i++) {
            if (!numbers.contains(i)) {
                jdbcTemplate.update("insert into entrances(id,block_id,number,created_at,updated_at) values (gen_random_uuid(),?,?,now(),now())", blockId, i);
            }
        }
        List<UUID> deleteIds = existing.stream()
            .filter(r -> ((Number) r.get("number")).intValue() > entrancesCount)
            .map(r -> UUID.fromString(String.valueOf(r.get("id"))))
            .toList();
        if (!deleteIds.isEmpty()) {
            String in = String.join(",", Collections.nCopies(deleteIds.size(), "?"));
            jdbcTemplate.update("delete from entrances where id in (" + in + ")", deleteIds.toArray());
        }
    }

    private void syncFloorsForBlock(UUID blockId) {
        BuildingBlockEntity block = blockRepo.findById(blockId).orElseThrow(() -> new ApiException("Block not found", "NOT_FOUND", null, 404));
        BuildingEntity building = buildingRepo.findById(block.getBuildingId()).orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        List<BuildingBlockEntity> allBlocks = blockRepo.findByBuildingId(block.getBuildingId());
        List<BlockFloorMarkerEntity> markers = markerRepo.findByBlockIdIn(List.of(blockId));
        List<Map<String, Object>> generated = floorGeneratorService.generateFloorsModel(block, building, allBlocks, markers);

        List<Map<String, Object>> existingFloors = jdbcTemplate.queryForList(
            "select id, index, parent_floor_index, basement_id from floors where block_id=?",
            blockId
        );
        Map<String, Map<String, Object>> existingByKey = existingFloors.stream()
            .collect(Collectors.toMap(this::floorConstraintKey, row -> row, (a, b) -> a));

        Set<String> seen = new HashSet<>();
        List<Map<String, Object>> target = generated.stream().filter(f -> seen.add(floorConstraintKey(f))).toList();

        Set<UUID> usedIds = new HashSet<>();
        for (Map<String, Object> floor : target) {
            Map<String, Object> existing = existingByKey.get(floorConstraintKey(floor));
            UUID id = existing == null ? UUID.randomUUID() : UUID.fromString(String.valueOf(existing.get("id")));
            usedIds.add(id);
            jdbcTemplate.update(
                "insert into floors(id, block_id, index, floor_key, label, floor_type, height, area_proj, is_technical, is_commercial, is_stylobate, is_basement, is_attic, is_loft, is_roof, parent_floor_index, basement_id, updated_at) " +
                    "values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
                    "on conflict (id) do update set block_id=excluded.block_id, index=excluded.index, floor_key=excluded.floor_key, label=excluded.label, floor_type=excluded.floor_type, height=excluded.height, area_proj=excluded.area_proj, is_technical=excluded.is_technical, is_commercial=excluded.is_commercial, is_stylobate=excluded.is_stylobate, is_basement=excluded.is_basement, is_attic=excluded.is_attic, is_loft=excluded.is_loft, is_roof=excluded.is_roof, parent_floor_index=excluded.parent_floor_index, basement_id=excluded.basement_id, updated_at=excluded.updated_at",
                id, floor.get("block_id"), floor.get("index"), floor.get("floor_key"), floor.get("label"), floor.get("floor_type"), floor.get("height"), floor.get("area_proj"),
                floor.get("is_technical"), floor.get("is_commercial"), floor.get("is_stylobate"), floor.get("is_basement"), floor.get("is_attic"), floor.get("is_loft"), floor.get("is_roof"),
                floor.get("parent_floor_index"), floor.get("basement_id"), Instant.now()
            );
        }

        List<UUID> toDelete = existingFloors.stream()
            .map(r -> UUID.fromString(String.valueOf(r.get("id"))))
            .filter(id -> !usedIds.contains(id))
            .toList();
        if (!toDelete.isEmpty()) {
            String in = String.join(",", Collections.nCopies(toDelete.size(), "?"));
            jdbcTemplate.update("delete from floors where id in (" + in + ")", toDelete.toArray());
        }
    }

    private void ensureEntranceMatrixForBlock(UUID blockId) {
        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<Map<String, Object>> entrances = jdbcTemplate.queryForList("select number from entrances where block_id=?", blockId);
        List<UUID> floorIds = floors.stream().map(r -> UUID.fromString(String.valueOf(r.get("id")))).toList();
        List<Integer> entranceNumbers = entrances.stream().map(r -> toNullableInt(r.get("number"))).filter(Objects::nonNull).filter(n -> n > 0).toList();
        if (floorIds.isEmpty() || entranceNumbers.isEmpty()) {
            jdbcTemplate.update("delete from entrance_matrix where block_id=?", blockId);
            return;
        }

        List<Map<String, Object>> existing = jdbcTemplate.queryForList("select id, floor_id, entrance_number from entrance_matrix where block_id=?", blockId);
        Set<String> existingKeys = new HashSet<>();
        List<UUID> stale = new ArrayList<>();
        Set<UUID> floorSet = new HashSet<>(floorIds);
        Set<Integer> entSet = new HashSet<>(entranceNumbers);

        for (Map<String, Object> row : existing) {
            UUID floorId = UUID.fromString(String.valueOf(row.get("floor_id")));
            int ent = toNullableInt(row.get("entrance_number")) == null ? 0 : toNullableInt(row.get("entrance_number"));
            if (!floorSet.contains(floorId) || !entSet.contains(ent)) stale.add(UUID.fromString(String.valueOf(row.get("id"))));
            else existingKeys.add(floorId + "|" + ent);
        }

        if (!stale.isEmpty()) {
            String in = String.join(",", Collections.nCopies(stale.size(), "?"));
            jdbcTemplate.update("delete from entrance_matrix where id in (" + in + ")", stale.toArray());
        }

        for (UUID floorId : floorIds) {
            for (Integer ent : entranceNumbers) {
                if (existingKeys.contains(floorId + "|" + ent)) continue;
                jdbcTemplate.update("insert into entrance_matrix(id,block_id,floor_id,entrance_number,updated_at) values (gen_random_uuid(),?,?,?,now()) on conflict (block_id,floor_id,entrance_number) do nothing", blockId, floorId, ent);
            }
        }
    }

    private String floorConstraintKey(Map<String, Object> floor) {
        int idx = toNullableInt(floor.get("index")) == null ? 0 : toNullableInt(floor.get("index"));
        int pfi = floor.get("parent_floor_index") == null ? -99999 : toNullableInt(floor.get("parent_floor_index"));
        String bid = String.valueOf(floor.getOrDefault("basement_id", "00000000-0000-0000-0000-000000000000"));
        return idx + "_" + pfi + "_" + bid;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> m) return (Map<String, Object>) m;
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(v -> (Map<String, Object>) v).toList();
    }

    private void putIfPresentPreserve(Map<String, Object> target, String key, String value) {
        if (value == null) return;
        if (value.isBlank()) return;
        target.put(key, value);
    }

    private void putIfNotBlank(Map<String, Object> target, String key, String value) {
        if (value == null) return;
        String normalized = value.trim();
        if (normalized.isBlank()) return;
        target.put(key, normalized);
    }

    private Integer toNullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        String s = String.valueOf(value);
        if (s.isBlank()) return null;
        return Integer.parseInt(s);
    }

    private boolean toBool(Object value) {
        if (value instanceof Boolean b) return b;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private int normalizeBasementDepth(Integer value) {
        int parsed = value == null ? 1 : value;
        return Math.min(4, Math.max(1, parsed));
    }

    private Instant parseInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }

    private List<Integer> toIntList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<Integer> result = new ArrayList<>();
        for (Object item : list) {
            Integer v = toNullableInt(item);
            if (v != null) result.add(v);
        }
        return result;
    }

    private JsonNode readJsonNode(String raw) {
        if (raw == null || raw.isBlank()) return objectMapper.createObjectNode();
        try {
            return objectMapper.readTree(raw);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    private String jsonbString(Object value) {
        try {
            return OBJECT_MAPPER.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException e) {
            throw new ApiException("Failed to encode json", "SERIALIZATION_ERROR", e.getMessage(), 500);
        }
    }

    private void requirePolicy(String module, String action, String message) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ActorPrincipal actor)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRole(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}
