package uz.reestrmkd.backend.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
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
        this.projectService = projectService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/projects/{projectId}/context")
    @Transactional
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
        Map<UUID, BuildingEntity> buildingMetaById = buildings.stream().collect(Collectors.toMap(BuildingEntity::getId, b -> b));

        Map<UUID, List<UUID>> featureBasementIdsByBuilding = new HashMap<>();

        for (Map.Entry<String, Object> entry : buildingDetails.entrySet()) {
            String key = entry.getKey();
            if (!key.contains("_features")) continue;

            String buildingRaw = key.replace("_features", "");
            if (buildingRaw.length() != 36) continue;
            UUID buildingId = UUID.fromString(buildingRaw);
            if (!knownBuildingIds.contains(buildingId)) continue;

            BuildingEntity buildingMeta = buildingMetaById.get(buildingId);
            boolean isUndergroundParkingBuilding = buildingMeta != null
                && "parking_separate".equals(buildingMeta.getCategory())
                && "underground".equals(buildingMeta.getParkingType());
            boolean isAbovegroundLightOrOpenParking = buildingMeta != null
                && "parking_separate".equals(buildingMeta.getCategory())
                && "aboveground".equals(buildingMeta.getParkingType())
                && ("light".equals(buildingMeta.getConstructionType()) || "open".equals(buildingMeta.getConstructionType()));
            if (isUndergroundParkingBuilding || isAbovegroundLightOrOpenParking) {
                featureBasementIdsByBuilding.put(buildingId, List.of());
                continue;
            }

            List<Map<String, Object>> detailsBasements = asList(asMap(entry.getValue()).get("basements"));
            List<Map<String, Object>> targetBlocks = jdbcTemplate.queryForList(
                "select id from building_blocks where building_id=? and coalesce(is_basement_block,false)=false",
                buildingId
            );
            UUID singleTargetBlockId = targetBlocks.size() == 1
                ? UUID.fromString(String.valueOf(targetBlocks.get(0).get("id")))
                : null;

            List<Map<String, Object>> sourceBasements = detailsBasements;
            if (buildingMeta != null && "infrastructure".equals(buildingMeta.getCategory()) && detailsBasements.size() > 1) {
                sourceBasements = detailsBasements.subList(0, 1);
            }

            List<UUID> ids = new ArrayList<>();
            int idx = 0;
          for (Map<String, Object> basement : sourceBasements) {
                if (basement.get("id") == null || basement.get("depth") == null) continue;
                UUID basementId = UUID.fromString(String.valueOf(basement.get("id")));

                LinkedHashSet<UUID> linkedBlockIds = new LinkedHashSet<>();
                Object blocksValue = basement.get("blocks");
                if (blocksValue instanceof List<?> list) {
                    for (Object value : list) {
                        UUID id = parseUuid(value);
                        if (id != null) linkedBlockIds.add(id);
                    }
                }
                UUID blockIdFromPayload = parseUuid(basement.get("blockId"));
                if (blockIdFromPayload != null) linkedBlockIds.add(blockIdFromPayload);
                if (linkedBlockIds.isEmpty() && singleTargetBlockId != null) linkedBlockIds.add(singleTargetBlockId);

                int depth = normalizeBasementDepth(toNullableInt(basement.get("depth")));
                int basementEntrances = Math.min(10, Math.max(1, Optional.ofNullable(toNullableInt(basement.get("entrancesCount"))).orElse(1)));
                String levelsJson = jsonbString(normalizeParkingLevelsByDepth(asMap(basement.get("parkingLevels")), depth));
                String commJson = jsonbString(normalizeBasementCommunications(asMap(basement.get("communications"))));

                // --- ИЗМЕНЕНИЕ: Обработка геометрии подвала ---
                Map<String, Object> normalizedBasementGeometry = toMultiPolygon(asMap(basement.get("blockGeometry")));
                String geometryJson = normalizedBasementGeometry == null ? null : jsonbString(normalizedBasementGeometry);
                // -----------------------------------------------

                jdbcTemplate.update(
                    "insert into building_blocks(id, building_id, label, type, is_basement_block, linked_block_ids, basement_depth, basement_has_parking, basement_parking_levels, basement_communications, floors_count, floors_from, floors_to, entrances_count, elevators_count, vehicle_entries, levels_depth, light_structure_type, parent_blocks, has_basement, has_attic, has_loft, has_roof_expl, has_custom_address, custom_house_number, footprint_geojson, updated_at) " +
                        "values (?,?,?,?,?,?::uuid[],?,?,?::jsonb,?::jsonb,?,?,?,?,?,?,?,?,?::uuid[],?,?,?,?,?,?,cast(? as jsonb),now()) " +
                        "on conflict (id) do update set label=excluded.label, linked_block_ids=excluded.linked_block_ids, basement_depth=excluded.basement_depth, basement_has_parking=excluded.basement_has_parking, basement_parking_levels=excluded.basement_parking_levels, basement_communications=excluded.basement_communications, entrances_count=excluded.entrances_count, footprint_geojson=coalesce(excluded.footprint_geojson, building_blocks.footprint_geojson), updated_at=now()",
                    basementId,
                    buildingId,
                    "Подвал " + (idx + 1),
                    "BAS",
                    true,
                    toPgUuidArrayLiteral(new ArrayList<>(linkedBlockIds)),
                    depth,
                    toBool(basement.get("hasParking")),
                    levelsJson,
                    commJson,
                    0,
                    null,
                    null,
                    basementEntrances,
                    0,
                    0,
                    0,
                    null,
                    "{}",
                    false,
                    false,
                    false,
                    false,
                    false,
                    null,
                    geometryJson // Передаем геометрию в INSERT
                );

                ids.add(basementId);
                idx += 1;
            }

            featureBasementIdsByBuilding.put(buildingId, ids);
        }

        for (Map.Entry<UUID, List<UUID>> entry : featureBasementIdsByBuilding.entrySet()) {
            UUID buildingId = entry.getKey();
            List<UUID> keepIds = entry.getValue();
            if (!buildingDetails.containsKey(buildingId + "_features")) continue;
            List<Map<String, Object>> existingBasements = jdbcTemplate.queryForList(
                "select id from building_blocks where building_id=? and coalesce(is_basement_block,false)=true",
                buildingId
            );
            List<UUID> deleteIds = existingBasements.stream()
                .map(r -> UUID.fromString(String.valueOf(r.get("id"))))
                .filter(id -> !keepIds.contains(id))
                .toList();
            if (!deleteIds.isEmpty()) {
                String in = String.join(",", Collections.nCopies(deleteIds.size(), "?"));
                jdbcTemplate.update("delete from building_blocks where id in (" + in + ")", deleteIds.toArray());
            }
        }

        for (Map.Entry<String, Object> entry : buildingDetails.entrySet()) {
            String key = entry.getKey();
            if (key.contains("_features")) continue;
            Map<String, Object> details = asMap(entry.getValue());
            String[] parts = key.split("_");
            String blockRaw = parts[parts.length - 1];
            if (blockRaw.length() != 36) continue;
            UUID blockId = UUID.fromString(blockRaw);

            List<Map<String, Object>> blockRows = jdbcTemplate.queryForList("select building_id from building_blocks where id=?", blockId);
            if (blockRows.isEmpty()) continue;
            UUID blockBuildingId = UUID.fromString(String.valueOf(blockRows.get(0).get("building_id")));

          Map<String, Object> normalizedBlockGeometry = toMultiPolygon(asMap(details.get("blockGeometry")));
            if (normalizedBlockGeometry != null) {
                // ИСПРАВЛЕНИЕ: Извлекаем геометрию сразу как текст, чтобы избежать двойной JSON-сериализации
                List<Map<String, Object>> geomRows = jdbcTemplate.queryForList("select cast(footprint_geojson as text) as geo_text from buildings where id=?", blockBuildingId);
                if (!geomRows.isEmpty() && geomRows.get(0).get("geo_text") != null) {
                    String buildingGeomText = String.valueOf(geomRows.get(0).get("geo_text"));
                Double outsideRatio = jdbcTemplate.queryForObject(
                         """
                         with g as (
                           select
                             st_makevalid(st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857))) as block_geom,
                             st_makevalid(st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857))) as building_geom
                         ),
                        a as (
                           select
                             nullif(st_area(block_geom), 0) as block_area,
                             st_area(st_intersection(block_geom, building_geom)) as inter_area
                           from g
                         )
                         select coalesce(greatest((block_area - inter_area) / block_area, 0), 1)
                         from a
                         """,
                         Double.class,
                         jsonbString(normalizedBlockGeometry),
                         buildingGeomText
                     );
                     if (outsideRatio == null || outsideRatio > 0.01d) {
                         throw new ApiException("Геометрия блока выходит за контур здания более чем на 1% площади", "VALIDATION_ERROR", null, 400);
                }
            }
        }
            Integer entrances = firstNonNull(toNullableInt(details.get("entrances")), toNullableInt(details.get("inputs")));
            Integer floorsTo = toNullableInt(details.get("floorsTo"));
            Integer floorsCount = floorsTo != null ? floorsTo : toNullableInt(details.get("floorsCount"));

            jdbcTemplate.update(
                "update building_blocks set floors_count=?, entrances_count=?, elevators_count=?, vehicle_entries=?, levels_depth=?, light_structure_type=?, parent_blocks=?::uuid[], floors_from=?, floors_to=?, has_basement=?, has_attic=?, has_loft=?, has_roof_expl=?, has_custom_address=?, custom_house_number=?, address_id=?, footprint_geojson=coalesce(cast(? as jsonb), footprint_geojson), updated_at=now() where id=?",
                floorsCount,
                entrances,
                toNullableInt(details.get("elevators")),
                toNullableInt(details.get("vehicleEntries")),
                toNullableInt(details.get("levelsDepth")),
                toNullIfBlank(details.get("lightStructureType")),
                toPgUuidArrayLiteral(parseUuidList(details.get("parentBlocks"))),
                toNullableInt(details.get("floorsFrom")),
                floorsTo,
                toBool(details.get("hasBasementFloor")),
                toBool(details.get("hasAttic")),
                toBool(details.get("hasLoft")),
                toBool(details.get("hasExploitableRoof")),
                toBool(details.get("hasCustomAddress")),
                toNullIfBlank(details.get("customHouseNumber")),
                parseUuid(details.get("addressId")),
                normalizedBlockGeometry == null ? null : jsonbString(normalizedBlockGeometry),
                blockId
            );

            saveBlockMarkers(blockId, details);
            syncFloorsForBlock(blockId);
            syncEntrancesForBlock(blockId, entrances == null ? 0 : entrances);
            ensureEntranceMatrixForBlock(blockId);

            if (hasAny(details, "foundation", "walls", "slabs", "roof") || details.get("seismicity") != null) {
                jdbcTemplate.update(
                    "insert into block_construction(id, block_id, foundation, walls, slabs, roof, seismicity, created_at, updated_at) values (gen_random_uuid(),?,?,?,?,?,?,now(),now()) " +
                        "on conflict (block_id) do update set foundation=excluded.foundation, walls=excluded.walls, slabs=excluded.slabs, roof=excluded.roof, seismicity=excluded.seismicity, updated_at=now()",
                    blockId,
                    toNullIfBlank(details.get("foundation")),
                    toNullIfBlank(details.get("walls")),
                    toNullIfBlank(details.get("slabs")),
                    toNullIfBlank(details.get("roof")),
                    toNullableInt(details.get("seismicity"))
                );
            }

            Map<String, Object> engineering = asMap(details.get("engineering"));
            if (!engineering.isEmpty()) {
                boolean heatingLocal = toBool(engineering.get("heatingLocal"));
                boolean heatingCentral = toBool(engineering.get("heatingCentral"));
                jdbcTemplate.update(
                    "insert into block_engineering(id, block_id, has_electricity, has_water, has_hot_water, has_ventilation, has_firefighting, has_lowcurrent, has_sewerage, has_gas, has_heating_local, has_heating_central, has_internet, has_solar_panels, has_heating, created_at, updated_at) values (gen_random_uuid(),?,?,?,?,?,?,?,?,?,?,?,?,?,?,now(),now()) " +
                        "on conflict (block_id) do update set has_electricity=excluded.has_electricity, has_water=excluded.has_water, has_hot_water=excluded.has_hot_water, has_ventilation=excluded.has_ventilation, has_firefighting=excluded.has_firefighting, has_lowcurrent=excluded.has_lowcurrent, has_sewerage=excluded.has_sewerage, has_gas=excluded.has_gas, has_heating_local=excluded.has_heating_local, has_heating_central=excluded.has_heating_central, has_internet=excluded.has_internet, has_solar_panels=excluded.has_solar_panels, has_heating=excluded.has_heating, updated_at=now()",
                    blockId,
                    toBool(engineering.get("electricity")),
                    toBool(engineering.get("hvs")),
                    toBool(engineering.get("gvs")),
                    toBool(engineering.get("ventilation")),
                    toBool(engineering.get("firefighting")),
                    toBool(engineering.get("lowcurrent")),
                    toBool(engineering.get("sewerage")),
                    toBool(engineering.get("gas")),
                    heatingLocal,
                    heatingCentral,
                    toBool(engineering.get("internet")),
                    toBool(engineering.get("solarPanels")),
                    heatingLocal || heatingCentral
                );
            }
        }

        return MapResponseDto.of(Map.of("ok", true, "projectId", projectId));
    }

    @PostMapping("/projects/{projectId}/context-meta/save")
    @Transactional
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
    @Transactional
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
        int defaultIndex = 100; // Чтобы избежать коллизий, если sourceIndex пустой
        
        for (GeometryCandidateImportItemDto candidate : candidates) {
            if (candidate.geometry() == null || candidate.geometry().isNull()) continue;
            
            try {
                String geojsonStr = jsonbString(candidate.geometry());
                String propertiesStr = jsonbString(candidate.properties() == null ? objectMapper.createObjectNode() : candidate.properties());
                
                // Делаем Upsert напрямую через SQL, обходя сломанную функцию в базе данных
                List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                    """
                    insert into project_geometry_candidates(
                        project_id, source_index, label, properties, geom_geojson, geom, area_m2, updated_at
                    ) values (
                        ?, ?, ?, ?::jsonb, ?::jsonb, 
                        st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857)), 
                        round(st_area(st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857)))::numeric, 2), 
                        now()
                    )
                    on conflict (project_id, source_index) do update set 
                        label = excluded.label,
                        properties = excluded.properties,
                        geom_geojson = excluded.geom_geojson,
                        geom = excluded.geom,
                        area_m2 = excluded.area_m2,
                        updated_at = now()
                    returning id
                    """,
                    projectId,
                    candidate.sourceIndex() == null ? defaultIndex++ : candidate.sourceIndex(),
                    candidate.label(),
                    propertiesStr,
                    geojsonStr,
                    geojsonStr, // Для 1-го вызова st_geomfromgeojson
                    geojsonStr  // Для 2-го вызова st_geomfromgeojson (подсчет площади)
                );
                
                if (!rows.isEmpty()) imported += 1;
            } catch (Exception e) {
                e.printStackTrace();
                throw new ApiException("Geometry import failed: " + e.getMessage(), "GEOMETRY_IMPORT_ERROR", e.getMessage(), 400);
            }
        }
        return MapResponseDto.of(Map.of("ok", true, "imported", imported));
    }

    @PostMapping("/projects/{projectId}/land-plot/select")
    @Transactional
    public OkResponseDto selectLand(@PathVariable UUID projectId, @RequestBody(required = false) Map<String, Object> payload) {
        requirePolicy("projectExtended", "mutate", "Role cannot select land plot geometry");
        UUID candidateId = extractCandidateId(payload);
        if (candidateId == null) {
            throw new ApiException("candidateId is required", "VALIDATION_ERROR", null, 400);
        }

        try {
            // 1. Получаем данные кандидата напрямую
            List<Map<String, Object>> candidates = jdbcTemplate.queryForList(
                "select cast(geom_geojson as text) as geojson, area_m2 from project_geometry_candidates where id = ? and project_id = ?",
                candidateId, projectId
            );
            if (candidates.isEmpty()) throw new ApiException("Candidate not found", "NOT_FOUND", null, 404);
            
            String geojsonStr = String.valueOf(candidates.get(0).get("geojson"));
            Object area = candidates.get(0).get("area_m2");

            // 2. Сбрасываем предыдущий выбор
            jdbcTemplate.update("update project_geometry_candidates set is_selected_land_plot = false, updated_at = now() where project_id = ?", projectId);
            
            // 3. Выбираем нового кандидата
            jdbcTemplate.update("update project_geometry_candidates set is_selected_land_plot = true, updated_at = now() where id = ?", candidateId);
            
            // 4. Сохраняем геометрию в проект с конвертацией в PostGIS
            jdbcTemplate.update(
                "update projects set land_plot_geojson = ?::jsonb, land_plot_geom = st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857)), land_plot_area_m2 = ?, updated_at = now() where id = ?",
                geojsonStr, geojsonStr, area, projectId
            );
        } catch (Exception e) {
            e.printStackTrace(); 
            throw new ApiException("Land plot selection failed", "GEOMETRY_ASSIGN_ERROR", e.getMessage(), 400);
        }
        return new OkResponseDto(true);
    }
    @PostMapping("/projects/{projectId}/land-plot/unselect")
    @Transactional
    public OkResponseDto unselectLand(@PathVariable UUID projectId) {
        requirePolicy("projectExtended", "mutate", "Role cannot unselect land plot geometry");
        jdbcTemplate.update(
            "update project_geometry_candidates set is_selected_land_plot = false, updated_at = now() where project_id = ?",
            projectId
        );
        jdbcTemplate.update(
            "update projects set land_plot_geojson = null, land_plot_geom = null, land_plot_area_m2 = null, updated_at = now() where id = ?",
            projectId
        );
        return new OkResponseDto(true);
    }

    @DeleteMapping("/projects/{projectId}/geometry-candidates/{candidateId}")
    @Transactional
    public OkResponseDto delCandidate(@PathVariable UUID projectId, @PathVariable UUID candidateId) {
        requirePolicy("projectExtended", "mutate", "Role cannot delete geometry candidate");

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "select assigned_building_id, is_selected_land_plot from project_geometry_candidates where id = ? and project_id = ?",
            candidateId,
            projectId
        );
        if (rows.isEmpty()) {
            throw new ApiException("Geometry candidate not found", "NOT_FOUND", null, 404);
        }

        UUID assignedBuildingId = parseUuid(rows.getFirst().get("assigned_building_id"));
        boolean isSelectedLandPlot = Boolean.TRUE.equals(rows.getFirst().get("is_selected_land_plot"));

        if (assignedBuildingId != null) {
            jdbcTemplate.update(
                "update buildings set geometry_candidate_id = null, footprint_geojson = null, building_footprint_geom = null, building_footprint_area_m2 = null, updated_at = now() where id = ? and project_id = ?",
                assignedBuildingId,
                projectId
            );
        }
        if (isSelectedLandPlot) {
            jdbcTemplate.update(
                "update projects set land_plot_geojson = null, land_plot_geom = null, land_plot_area_m2 = null, updated_at = now() where id = ?",
                projectId
            );
        }

        jdbcTemplate.update("delete from project_geometry_candidates where id = ? and project_id = ?", candidateId, projectId);
        return new OkResponseDto(true);
    }

  @PostMapping("/projects/{projectId}/buildings/{buildingId}/geometry/select")
    @Transactional
    public OkResponseDto selectBuildingGeometry(
        @PathVariable UUID projectId,
        @PathVariable UUID buildingId,
        @RequestBody(required = false) Map<String, Object> payload
    ) {
        requirePolicy("projectExtended", "mutate", "Role cannot select building geometry");
        UUID candidateId = extractCandidateId(payload);

        if (candidateId == null) {
            jdbcTemplate.update(
                "update project_geometry_candidates set assigned_building_id = null, updated_at = now() where project_id = ? and assigned_building_id = ?",
                projectId, buildingId
            );
            jdbcTemplate.update(
                "update buildings set geometry_candidate_id = null, footprint_geojson = null, building_footprint_geom = null, building_footprint_area_m2 = null, updated_at = now() where id = ? and project_id = ?",
                buildingId, projectId
            );
            return new OkResponseDto(true);
        }

        try {
            // 1. Получаем данные кандидата напрямую
            List<Map<String, Object>> candidates = jdbcTemplate.queryForList(
                "select cast(geom_geojson as text) as geojson, area_m2 from project_geometry_candidates where id = ? and project_id = ?",
                candidateId, projectId
            );
            if (candidates.isEmpty()) throw new ApiException("Candidate not found", "NOT_FOUND", null, 404);
            String geojsonStr = String.valueOf(candidates.get(0).get("geojson"));
            Object area = candidates.get(0).get("area_m2");

            // 2. Проверяем наличие выделенного участка земли у проекта
            Boolean hasLandPlot = jdbcTemplate.queryForObject("select (land_plot_geom is not null) from projects where id = ?", Boolean.class, projectId);
            if (!Boolean.TRUE.equals(hasLandPlot)) throw new ApiException("Land plot is not selected", "VALIDATION_ERROR", null, 400);

            // 3. Проверка: здание должно быть внутри участка
            Boolean covered = jdbcTemplate.queryForObject(
                "select st_coveredby(st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857)), land_plot_geom) from projects where id = ?",
                Boolean.class, geojsonStr, projectId
            );
            if (!Boolean.TRUE.equals(covered)) throw new ApiException("Building geometry must be within land plot", "VALIDATION_ERROR", null, 400);

            // 4. Проверка пересечений с другими зданиями комплекса
            Boolean intersects = jdbcTemplate.queryForObject(
                "select exists(select 1 from buildings b where b.project_id = ? and b.id <> ? and b.building_footprint_geom is not null and st_intersects(st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857)), b.building_footprint_geom) and not st_touches(st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857)), b.building_footprint_geom))",
                Boolean.class, projectId, buildingId, geojsonStr, geojsonStr
            );
            if (Boolean.TRUE.equals(intersects)) throw new ApiException("Building geometry intersects another building", "VALIDATION_ERROR", null, 400);

            // 5. Сохраняем геометрию в здание
            int updated = jdbcTemplate.update(
                "update buildings set footprint_geojson = ?::jsonb, building_footprint_geom = st_multi(st_setsrid(st_geomfromgeojson(?::text), 3857)), building_footprint_area_m2 = ?, geometry_candidate_id = ?, updated_at = now() where id = ? and project_id = ?",
                geojsonStr, geojsonStr, area, candidateId, buildingId, projectId
            );
            if (updated == 0) throw new ApiException("Building not found", "NOT_FOUND", null, 404);

            // 6. Привязываем кандидата к этому зданию
            jdbcTemplate.update("update project_geometry_candidates set assigned_building_id = null, updated_at = now() where project_id = ? and assigned_building_id = ? and id <> ?", projectId, buildingId, candidateId);
            jdbcTemplate.update("update project_geometry_candidates set assigned_building_id = ?, updated_at = now() where id = ?", buildingId, candidateId);

        } catch (Exception e) {
            e.printStackTrace(); 
            throw new ApiException("Building geometry selection failed", "GEOMETRY_ASSIGN_ERROR", e.getMessage(), 400);
        }

        return new OkResponseDto(true);
    }
    @GetMapping("/projects/{projectId}/passport")
    public MapResponseDto passport(@PathVariable UUID projectId) {
        List<Map<String, Object>> projects = jdbcTemplate.queryForList("select * from projects where id = ?", projectId);
        if (projects.isEmpty()) {
            throw new ApiException("Project not found", "NOT_FOUND", null, 404);
        }
        Map<String, Object> project = projects.getFirst();

        UUID addressId = project.get("address_id") == null ? null : UUID.fromString(String.valueOf(project.get("address_id")));
        Map<String, Object> address = addressId == null
            ? Map.of()
            : jdbcTemplate.queryForList("select district, street, mahalla, building_no from addresses where id = ?", addressId).stream().findFirst().orElse(Map.of());

        String regionSoato = null;
        Object districtSoato = address.get("district");
        if (districtSoato != null) {
            List<Map<String, Object>> drows = jdbcTemplate.queryForList("select region_id from districts where soato = ?", String.valueOf(districtSoato));
            if (!drows.isEmpty() && drows.getFirst().get("region_id") != null) {
                List<Map<String, Object>> rrows = jdbcTemplate.queryForList("select soato from regions where id = ?", drows.getFirst().get("region_id"));
                if (!rrows.isEmpty()) regionSoato = rrows.getFirst().get("soato") == null ? null : String.valueOf(rrows.getFirst().get("soato"));
            }
        }

        List<Map<String, Object>> participantsRows = jdbcTemplate.queryForList("select * from project_participants where project_id = ?", projectId);
        List<Map<String, Object>> docsRows = jdbcTemplate.queryForList("select * from project_documents where project_id = ? order by doc_date desc nulls last", projectId);

Map<String, Object> participants = new LinkedHashMap<>();
        for (Map<String, Object> part : participantsRows) {
            String role = String.valueOf(part.get("role"));
            Map<String, Object> pMap = new HashMap<>();
            pMap.put("id", part.get("id"));
            pMap.put("name", part.get("name"));
            pMap.put("inn", part.get("inn"));
            pMap.put("role", role);
            participants.put(role, pMap);
        }

        List<Map<String, Object>> documents = docsRows.stream().map(d -> {
            Map<String, Object> doc = new LinkedHashMap<>();
            doc.put("id", d.get("id"));
            doc.put("name", d.get("name"));
            doc.put("type", d.get("doc_type"));
            doc.put("date", d.get("doc_date"));
            doc.put("number", d.get("doc_number"));
            doc.put("url", d.get("file_url"));
            return doc;
        }).toList();

        Map<String, Object> complexInfo = new LinkedHashMap<>();
        complexInfo.put("name", project.get("name"));
        complexInfo.put("ujCode", project.get("uj_code"));
        complexInfo.put("ujCode", project.get("uj_code"));
        complexInfo.put("status", project.get("construction_status"));
        complexInfo.put("region", project.get("region"));
        complexInfo.put("district", project.get("district"));
        complexInfo.put("street", project.get("address"));
        complexInfo.put("landmark", project.get("landmark"));
        complexInfo.put("addressId", project.get("address_id"));
        complexInfo.put("dateStartProject", project.get("date_start_project"));
        complexInfo.put("dateEndProject", project.get("date_end_project"));
        complexInfo.put("dateStartFact", project.get("date_start_fact"));
        complexInfo.put("dateEndFact", project.get("date_end_fact"));
        complexInfo.put("regionSoato", regionSoato);
        complexInfo.put("districtSoato", address.get("district"));
        complexInfo.put("streetId", address.get("street"));
        complexInfo.put("mahallaId", address.get("mahalla"));
        complexInfo.put("buildingNo", address.get("building_no"));

   Map<String, Object> cadastreInfo = new HashMap<>();
        cadastreInfo.put("number", project.get("cadastre_number"));
        cadastreInfo.put("area", project.get("land_plot_area_m2"));

        Map<String, Object> landPlotInfo = new HashMap<>();
        landPlotInfo.put("geometry", project.get("land_plot_geojson"));
        landPlotInfo.put("areaM2", project.get("land_plot_area_m2"));

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("complexInfo", complexInfo);
        responseData.put("cadastre", cadastreInfo);
        responseData.put("landPlot", landPlotInfo);
        responseData.put("participants", participants);
        responseData.put("documents", documents);

        return MapResponseDto.of(responseData);
    }

  @PutMapping("/projects/{projectId}/passport")
    public MapResponseDto updatePassport(@PathVariable UUID projectId, @RequestBody(required = false) ProjectPassportUpdateRequestDto payload){
        requirePolicy("projectExtended", "mutate", "Role cannot update passport");
        ProjectPassportInfoDto info = payload == null ? null : payload.info();
        ProjectCadastreDataDto cadastreData = payload == null ? null : payload.cadastreData();

        // 1. ИСПРАВЛЕНИЕ: Получаем текущий address_id из проекта, чтобы не создавать дубликаты
        List<Map<String, Object>> projRows = jdbcTemplate.queryForList("select address_id from projects where id=?", projectId);
        if (projRows.isEmpty()) {
            throw new ApiException("Project not found", "NOT_FOUND", null, 404);
        }
        UUID currentAddressId = parseUuid(projRows.getFirst().get("address_id"));

        // 2. Передаем currentAddressId вместо null
        UUID addressId = info == null ? null : ensureAddressRecord(
            currentAddressId, 
            info.districtSoato(),
            info.streetId(),
            info.mahallaId(),
            info.buildingNo(),
            info.region(),
            info.district(),
            info.mahalla(),
            info.street()
        );

        String finalAddress = info == null ? null : buildFullAddress(info.region(), info.district(), info.mahalla(), info.street(), info.buildingNo());

        jdbcTemplate.update(
            "update projects set name=coalesce(?, name), region=coalesce(?, region), district=coalesce(?, district), address=coalesce(?, address), landmark=coalesce(?, landmark), construction_status=coalesce(?, construction_status), date_start_project=coalesce(?, date_start_project), date_end_project=coalesce(?, date_end_project), date_start_fact=coalesce(?, date_start_fact), date_end_fact=coalesce(?, date_end_fact), address_id=coalesce(?, address_id), cadastre_number=coalesce(?, cadastre_number), land_plot_area_m2=coalesce(?, land_plot_area_m2), updated_at=now() where id=?",
            info == null ? null : info.name(),
            info == null ? null : info.region(),
            info == null ? null : info.district(),
            finalAddress,
            info == null ? null : info.landmark(),
            info == null || info.status() == null ? null : info.status().value(),
            info == null ? null : info.dateStartProject(),
            info == null ? null : info.dateEndProject(),
            info == null ? null : info.dateStartFact(),
            info == null ? null : info.dateEndFact(),
            addressId,
            cadastreData == null ? null : uz.reestrmkd.backend.service.FormatUtils.formatComplexCadastre(cadastreData.number()),
            cadastreData == null ? null : cadastreData.area(),
            projectId
        );

        Map<String, Object> updated = jdbcTemplate.queryForMap("select * from projects where id=?", projectId);
        return MapResponseDto.of(updated);
    }

    @PutMapping("/projects/{projectId}/participants/{role}")
    public MapResponseDto upsertParticipant(@PathVariable UUID projectId, @PathVariable String role, @RequestBody(required = false) MapPayloadDto payload){
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("projectExtended", "mutate", "Role cannot update participants");

        String normalizedRole = role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("developer", "contractor", "customer").contains(normalizedRole)) {
            throw new ApiException("Unsupported participant role", "VALIDATION_ERROR", null, 400);
        }

        Object id = body.get("id");
        UUID pid = id == null || String.valueOf(id).isBlank() ? UUID.randomUUID() : UUID.fromString(String.valueOf(id));

        jdbcTemplate.update(
            "insert into project_participants(id,project_id,role,name,inn,created_at,updated_at) values (?,?,?,?,?,now(),now()) on conflict (id) do update set role=excluded.role, name=excluded.name, inn=excluded.inn, updated_at=now()",
            pid,
            projectId,
            normalizedRole,
            body.getOrDefault("name", ""),
            body.getOrDefault("inn", "")
        );

        return MapResponseDto.of(jdbcTemplate.queryForMap("select * from project_participants where id = ?", pid));
    }

    @PostMapping("/projects/{projectId}/documents")
    public MapResponseDto upsertDoc(@PathVariable UUID projectId, @RequestBody(required = false) MapPayloadDto payload){
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        Map<String, Object> doc = asMap(body.get("doc"));
        if (doc.isEmpty()) doc = body;
        requirePolicy("projectExtended", "mutate", "Role cannot update documents");

        Object id = doc.get("id");
        UUID docId = id == null || String.valueOf(id).isBlank() ? UUID.randomUUID() : UUID.fromString(String.valueOf(id));

        jdbcTemplate.update(
            "insert into project_documents(id,project_id,name,doc_type,doc_date,doc_number,file_url,created_at,updated_at) values (?,?,?,?,?,?,?,now(),now()) on conflict (id) do update set name=excluded.name, doc_type=excluded.doc_type, doc_date=excluded.doc_date, doc_number=excluded.doc_number, file_url=excluded.file_url, updated_at=now()",
            docId,
            projectId,
            doc.getOrDefault("name", ""),
            doc.getOrDefault("type", ""),
            doc.get("date"),
            doc.getOrDefault("number", ""),
            doc.get("url")
        );

        return MapResponseDto.of(jdbcTemplate.queryForMap("select * from project_documents where id = ?", docId));
    }

    @DeleteMapping("/project-documents/{documentId}")
    public MapResponseDto delDoc(@PathVariable UUID documentId){
        requirePolicy("projectExtended", "mutate", "Role cannot delete documents");
        jdbcTemplate.update("delete from project_documents where id = ?",documentId);
        return MapResponseDto.of(Map.of("ok", true));
    }    
    @DeleteMapping("/projects/{projectId}") public OkResponseDto delProject(@PathVariable UUID projectId){requirePolicy("projectExtended", "deleteProject", "Role cannot delete project");jdbcTemplate.update("delete from projects where id = ?",projectId);return new OkResponseDto(true);}    
  @GetMapping("/projects/{projectId}/full-registry")
    public Map<String, Object> fullRegistry(@PathVariable UUID projectId) {
        // 0. Здания
        List<Map<String, Object>> dbBuildings = jdbcTemplate.queryForList(
            "select id, project_id, building_code, label, house_number, category " +
            "from buildings where project_id = ?", projectId);

        List<Map<String, Object>> buildings = new ArrayList<>();
        for (Map<String, Object> row : dbBuildings) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", row.get("id"));
            map.put("projectId", row.get("project_id"));
            map.put("buildingCode", row.get("building_code"));
            map.put("label", row.get("label"));
            map.put("houseNumber", row.get("house_number"));
            map.put("category", row.get("category"));
            buildings.add(map);
        }

        // 1. Блоки
        List<Map<String, Object>> dbBlocks = jdbcTemplate.queryForList(
            "select bb.id, bb.building_id, bb.label, bb.type, bb.is_basement_block, bb.floors_count " +
            "from building_blocks bb join buildings b on b.id = bb.building_id where b.project_id = ?", projectId);

        List<Map<String, Object>> blocks = new ArrayList<>();
        for (Map<String, Object> row : dbBlocks) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", row.get("id"));
            map.put("buildingId", row.get("building_id"));
            map.put("label", row.get("label"));
            map.put("tabLabel", row.get("label"));
            map.put("type", row.get("type"));
            map.put("isBasementBlock", row.get("is_basement_block"));
            map.put("floorsCount", row.get("floors_count"));
            blocks.add(map);
        }

        // 2. Этажи
        List<Map<String, Object>> dbFloors = jdbcTemplate.queryForList(
            "select f.id, f.block_id, f.index, f.label, f.floor_type, f.is_duplex " +
            "from floors f join building_blocks bb on bb.id = f.block_id join buildings b on b.id = bb.building_id where b.project_id = ?", projectId);

        List<Map<String, Object>> floors = new ArrayList<>();
        for (Map<String, Object> row : dbFloors) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", row.get("id"));
            map.put("blockId", row.get("block_id"));
            map.put("index", row.get("index"));
            map.put("label", row.get("label"));
            map.put("type", row.get("floor_type"));
            map.put("isDuplex", row.get("is_duplex"));
            floors.add(map);
        }

        // 3. Подъезды
        List<Map<String, Object>> dbEntrances = jdbcTemplate.queryForList(
            "select e.id, e.block_id, e.number " +
            "from entrances e join building_blocks bb on bb.id = e.block_id join buildings b on b.id = bb.building_id where b.project_id = ?", projectId);

        List<Map<String, Object>> entrances = new ArrayList<>();
        for (Map<String, Object> row : dbEntrances) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", row.get("id"));
            map.put("blockId", row.get("block_id"));
            map.put("number", row.get("number"));
            entrances.add(map);
        }

        // 4. Комнаты (для поля explication)
        List<Map<String, Object>> dbRooms = jdbcTemplate.queryForList(
            "select r.id, r.unit_id, r.room_type, r.area, r.room_height, r.is_mezzanine, r.level " +
            "from rooms r join units u on u.id = r.unit_id join floors f on f.id = u.floor_id join building_blocks bb on bb.id = f.block_id join buildings b on b.id = bb.building_id where b.project_id = ?", projectId);

        Map<UUID, List<Map<String, Object>>> roomsByUnit = new HashMap<>();
        for (Map<String, Object> r : dbRooms) {
            Map<String, Object> rm = new HashMap<>();
            rm.put("id", r.get("id"));
            rm.put("unitId", r.get("unit_id"));
            rm.put("type", r.get("room_type"));
            rm.put("area", r.get("area"));
            rm.put("height", r.get("room_height"));
            rm.put("isMezzanine", r.get("is_mezzanine"));
            rm.put("level", r.get("level"));
            
            UUID uId = (UUID) r.get("unit_id");
            roomsByUnit.computeIfAbsent(uId, k -> new ArrayList<>()).add(rm);
        }

       // 5. Помещения (квартиры и коммерция)
        // ДОБАВЛЕНО: u.cadastre_number, b.id as building_id, b.building_code
        List<Map<String, Object>> dbUnits = jdbcTemplate.queryForList(
            "select u.id, u.floor_id, u.entrance_id, u.unit_code, u.unit_type, u.number, u.total_area, u.living_area, u.useful_area, u.rooms_count, u.has_mezzanine, u.mezzanine_type, u.cadastre_number, b.id as building_id, b.building_code " +
            "from units u join floors f on f.id = u.floor_id join building_blocks bb on bb.id = f.block_id join buildings b on b.id = bb.building_id where b.project_id = ?", projectId);

        List<Map<String, Object>> units = new ArrayList<>();
        for (Map<String, Object> row : dbUnits) {
            Map<String, Object> map = new HashMap<>();
            UUID uId = (UUID) row.get("id");
            map.put("id", uId);
            map.put("floorId", row.get("floor_id"));
            map.put("entranceId", row.get("entrance_id"));
            map.put("unitCode", row.get("unit_code"));
            map.put("type", row.get("unit_type"));
            map.put("num", row.get("number"));
            map.put("number", row.get("number"));
            map.put("area", row.get("total_area"));
            map.put("livingArea", row.get("living_area"));
            map.put("usefulArea", row.get("useful_area"));
            map.put("rooms", row.get("rooms_count")); 
            map.put("hasMezzanine", row.get("has_mezzanine"));
            map.put("mezzanineType", row.get("mezzanine_type"));
            
            // ДОБАВЛЕННЫЕ ПОЛЯ ДЛЯ УЗКАД:
            map.put("cadastreNumber", row.get("cadastre_number"));
            map.put("buildingId", row.get("building_id"));
            map.put("buildingCode", row.get("building_code"));
            
            map.put("explication", roomsByUnit.getOrDefault(uId, new ArrayList<>()));
            units.add(map);
        }

        // 6. Формирование итогового ответа
        Map<String, Object> response = new HashMap<>();
        response.put("buildings", buildings); // Добавлено!
        response.put("blocks", blocks);
        response.put("floors", floors);
        response.put("entrances", entrances);
        response.put("units", units);

        return response;
    }
    @GetMapping("/versions") public ItemsResponseDto versions(@RequestParam(required=false) String entityType,@RequestParam(required=false) UUID entityId){ if(entityType!=null && entityId!=null) return new ItemsResponseDto(jdbcTemplate.queryForList("select * from object_versions where entity_type=? and entity_id=? order by version_number desc",entityType,entityId)); return new ItemsResponseDto(jdbcTemplate.queryForList("select * from object_versions order by updated_at desc limit 100")); }
    @PostMapping("/versions") public MapResponseDto createVersion(@RequestBody(required = false) MapPayloadDto payload){ Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data(); return MapResponseDto.of(Map.of("result",versionService.createPendingVersionsForApplication(UUID.fromString(String.valueOf(body.get("projectId"))), UUID.fromString(String.valueOf(body.get("applicationId"))), body.get("createdBy")==null?null:String.valueOf(body.get("createdBy"))))); }
    @PostMapping("/versions/{versionId}/approve") public OkResponseDto approveVersion(@PathVariable Long versionId){jdbcTemplate.update("update object_versions set version_status='CURRENT', updated_at=now() where id=?",versionId);return new OkResponseDto(true);}    
    @PostMapping("/versions/{versionId}/decline") public OkResponseDto declineVersion(@PathVariable Long versionId){jdbcTemplate.update("update object_versions set version_status='DECLINED', updated_at=now() where id=?",versionId);return new OkResponseDto(true);}    
    @GetMapping("/versions/{versionId}/snapshot") public MapResponseDto snapshot(@PathVariable Long versionId){return MapResponseDto.of(jdbcTemplate.queryForMap("select snapshot_data from object_versions where id=?",versionId));}    
    @PostMapping("/versions/{versionId}/restore") public OkResponseDto restore(@PathVariable Long versionId){jdbcTemplate.update("update object_versions set version_status='CURRENT', updated_at=now() where id=?",versionId);return new OkResponseDto(true);}    


private UUID ensureAddressRecord(
            UUID addressId, 
            String districtSoato, 
            String streetId, 
            String mahallaId, 
            String buildingNo, 
            String regionName, 
            String districtName, 
            String mahallaName, 
            String streetName 
    ) {
        boolean hasAddressData = !isBlank(districtSoato) || !isBlank(streetId) || !isBlank(mahallaId) || !isBlank(buildingNo);
        if (!hasAddressData) {
            return addressId;
        }

        UUID resolvedAddressId = addressId == null ? UUID.randomUUID() : addressId;
        String fullAddress = buildFullAddress(regionName, districtName, mahallaName, streetName, buildingNo);

        jdbcTemplate.update(
            "insert into addresses(id, dtype, versionrev, district, street, mahalla, city, building_no, full_address) values (?,?,0,?,?,?,?,?,?) " +
                "on conflict (id) do update set district=excluded.district, street=excluded.street, mahalla=excluded.mahalla, city=excluded.city, building_no=excluded.building_no, full_address=excluded.full_address",
            resolvedAddressId,
            "Address",
            districtSoato,
            parseUuid(streetId), // ИСПРАВЛЕНИЕ: Конвертируем String в java.util.UUID
            parseUuid(mahallaId), // ИСПРАВЛЕНИЕ: Конвертируем String в java.util.UUID
            regionName,
            buildingNo,
            fullAddress
        );

        return resolvedAddressId;
    }
    
private String buildFullAddress(String regionName, String districtName, String mahallaName, String streetName, String buildingNo) {
        List<String> parts = new ArrayList<>();
        
        // Если streetName уже содержит регион, не добавляем его повторно
        if (!isBlank(regionName) && (isBlank(streetName) || !streetName.contains(regionName.trim()))) {
            parts.add(regionName.trim());
        }
        
        // Если streetName уже содержит район, не добавляем его
        if (!isBlank(districtName) && (isBlank(streetName) || !streetName.contains(districtName.trim()))) {
            parts.add(districtName.trim());
        }
        
        // Если streetName уже содержит махаллю, не добавляем ее
        if (!isBlank(mahallaName) && (isBlank(streetName) || !streetName.contains(mahallaName.trim()))) {
            parts.add(mahallaName.trim());
        }
        
        // Добавляем саму строку, которую прислал фронтенд в поле street (часто это полный адрес)
        if (!isBlank(streetName)) {
            parts.add(streetName.trim());
        }
        
        // Если номер дома передан отдельно и его еще нет в строке адреса, добавляем
        if (!isBlank(buildingNo) && (isBlank(streetName) || !streetName.matches(".*\\b" + buildingNo.trim() + "\\b.*"))) {
            parts.add("д. " + buildingNo.trim());
        }
        
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

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
            
            try {
                // ИСПРАВЛЕНИЕ: используем now() в самом SQL вместо Instant.now(), 
                // безопасно приводим строки (чтобы не получить строку "null")
                Object fk = floor.get("floor_key");
                Object lbl = floor.get("label");
                Object ft = floor.get("floor_type");
                
                jdbcTemplate.update(
                    "insert into floors(id, block_id, index, floor_key, label, floor_type, height, area_proj, is_technical, is_commercial, is_stylobate, is_basement, is_attic, is_loft, is_roof, parent_floor_index, basement_id, updated_at) " +
                        "values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,now()) " +
                        "on conflict (id) do update set block_id=excluded.block_id, index=excluded.index, floor_key=excluded.floor_key, label=excluded.label, floor_type=excluded.floor_type, height=excluded.height, area_proj=excluded.area_proj, is_technical=excluded.is_technical, is_commercial=excluded.is_commercial, is_stylobate=excluded.is_stylobate, is_basement=excluded.is_basement, is_attic=excluded.is_attic, is_loft=excluded.is_loft, is_roof=excluded.is_roof, parent_floor_index=excluded.parent_floor_index, basement_id=excluded.basement_id, updated_at=now()",
                    id, 
                    parseUuid(floor.get("block_id")), 
                    toNullableInt(floor.get("index")), 
                    fk == null ? null : String.valueOf(fk), 
                    lbl == null ? null : String.valueOf(lbl), 
                    ft == null ? null : String.valueOf(ft), 
                    floor.get("height") != null ? Double.parseDouble(String.valueOf(floor.get("height"))) : null, 
                    floor.get("area_proj") != null ? Double.parseDouble(String.valueOf(floor.get("area_proj"))) : null,
                    toBool(floor.get("is_technical")), 
                    toBool(floor.get("is_commercial")), 
                    toBool(floor.get("is_stylobate")), 
                    toBool(floor.get("is_basement")), 
                    toBool(floor.get("is_attic")), 
                    toBool(floor.get("is_loft")), 
                    toBool(floor.get("is_roof")),
                    toNullableInt(floor.get("parent_floor_index")), 
                    parseUuid(floor.get("basement_id"))
                );
            } catch (Exception e) {
                e.printStackTrace();
                throw new ApiException("Floor sync failed: " + e.getMessage(), "SYNC_ERROR", e.getMessage(), 500);
            }
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

    private void saveBlockMarkers(UUID blockId, Map<String, Object> details) {
        Set<String> technicalKeys = new HashSet<>();
        Object technicalFloors = details.get("technicalFloors");
        if (technicalFloors instanceof List<?> list) {
            for (Object raw : list) {
                String markerKey = null;
                if (raw instanceof String s && s.contains("-Т")) {
                    markerKey = s;
                } else {
                    Integer parsed = toNullableInt(raw);
                    if (parsed != null) markerKey = parsed + "-Т";
                }
                if (markerKey != null) technicalKeys.add(markerKey);
            }
        }

        Set<String> commercialKeys = new HashSet<>();
        Object commercialFloors = details.get("commercialFloors");
        if (commercialFloors instanceof List<?> list) {
            for (Object raw : list) {
                if (raw != null) commercialKeys.add(String.valueOf(raw));
            }
        }

        jdbcTemplate.update("delete from block_floor_markers where block_id=?", blockId);

        LinkedHashSet<String> markerKeys = new LinkedHashSet<>();
        markerKeys.addAll(technicalKeys);
        markerKeys.addAll(commercialKeys);

        for (String markerKey : markerKeys) {
            Integer floorIndex = null;
            if (markerKey.endsWith("-Т")) {
                floorIndex = toNullableInt(markerKey.replace("-Т", ""));
            } else if (markerKey.matches("^-?\\d+$")) {
                floorIndex = Integer.parseInt(markerKey);
            }

            String markerType = "floor";
            if (markerKey.startsWith("basement_")) markerType = "basement";
            else if (markerKey.endsWith("-Т")) markerType = "technical";
            else if (Set.of("attic", "loft", "roof", "tsokol").contains(markerKey)) markerType = "special";

            jdbcTemplate.update(
                "insert into block_floor_markers(id, block_id, marker_key, marker_type, floor_index, is_technical, is_commercial, created_at, updated_at) values (gen_random_uuid(),?,?,?,?,?,?,now(),now()) " +
                    "on conflict (block_id, marker_key) do update set marker_type=excluded.marker_type, floor_index=excluded.floor_index, is_technical=excluded.is_technical, is_commercial=excluded.is_commercial, updated_at=now()",
                blockId,
                markerKey,
                markerType,
                floorIndex,
                technicalKeys.contains(markerKey),
                commercialKeys.contains(markerKey)
            );
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
        String s = String.valueOf(value).trim();
        if (s.isBlank()) return null;
        try {
            return Integer.parseInt(s);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean toBool(Object value) {
        if (value instanceof Boolean b) return b;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private <T> T firstNonNull(T left, T right) {
        return left != null ? left : right;
    }

    private boolean hasAny(Map<String, Object> details, String... fields) {
        for (String field : fields) {
            Object value = details.get(field);
            if (value == null) continue;
            if (value instanceof String s && s.isBlank()) continue;
            return true;
        }
        return false;
    }

    private UUID extractCandidateId(Map<String, Object> payload) {
        Map<String, Object> body = payload == null ? Map.of() : payload;
        Object direct = body.get("candidateId");
        if (direct != null) return parseUuid(direct);
        return parseUuid(asMap(body.get("data")).get("candidateId"));
    }

    private UUID parseUuid(Object value) {
        if (value == null) return null;
        String raw = String.valueOf(value).trim();
        if (raw.isBlank() || raw.length() != 36) return null;
        try {
            return UUID.fromString(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private List<UUID> parseUuidList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<UUID> ids = new ArrayList<>();
        for (Object item : list) {
            UUID id = parseUuid(item);
            if (id != null) ids.add(id);
        }
        return ids;
    }

    private String toPgUuidArrayLiteral(List<UUID> ids) {
        if (ids == null || ids.isEmpty()) return "{}";
        return "{" + ids.stream().map(UUID::toString).collect(Collectors.joining(",")) + "}";
    }

    private String toNullIfBlank(Object value) {
        if (value == null) return null;
        String normalized = String.valueOf(value).trim();
        return normalized.isBlank() ? null : normalized;
    }

    private Map<String, Object> toMultiPolygon(Map<String, Object> geometry) {
        if (geometry.isEmpty()) return null;
        String type = String.valueOf(geometry.getOrDefault("type", ""));
        if ("MultiPolygon".equals(type)) return geometry;
        if ("Polygon".equals(type) && geometry.get("coordinates") != null) {
            return Map.of("type", "MultiPolygon", "coordinates", List.of(geometry.get("coordinates")));
        }
        return null;
    }

    private Map<String, Object> normalizeParkingLevelsByDepth(Map<String, Object> levels, int depth) {
        Map<String, Object> normalized = new HashMap<>();
        for (Map.Entry<String, Object> entry : levels.entrySet()) {
            Integer level = toNullableInt(entry.getKey());
            if (level == null || level < 1 || level > depth) continue;
            normalized.put(String.valueOf(level), toBool(entry.getValue()));
        }
        return normalized;
    }

    private Map<String, Object> normalizeBasementCommunications(Map<String, Object> communications) {
        Map<String, Object> normalized = new HashMap<>();
        for (String key : List.of("electricity", "water", "sewerage", "heating", "ventilation", "gas", "firefighting")) {
            normalized.put(key, toBool(communications.get(key)));
        }
        return normalized;
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
