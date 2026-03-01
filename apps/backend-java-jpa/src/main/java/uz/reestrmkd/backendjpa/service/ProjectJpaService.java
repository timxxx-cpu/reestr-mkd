package uz.reestrmkd.backendjpa.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.persistence.Tuple;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestrmkd.backendjpa.repo.ApplicationRepository;
import uz.reestrmkd.backendjpa.repo.ProjectRepository;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ProjectJpaService {
    private final ProjectRepository projects;
    private final ApplicationRepository applications;
    private final ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager em;

    public Map<String, Object> list(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope is required");
        }
        var items = projects.findByScopeIdOrderByIdDesc(scope);
        return Map.of("items", items, "total", items.size());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mapOverview(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope is required");
        }

        List<Map<String, Object>> projectRows = queryList(
            "select id, uj_code, name, land_plot_geojson from projects where scope_id = :scope order by updated_at desc",
            Map.of("scope", scope)
        );

        List<Map<String, Object>> buildingRows = queryList(
            "select id, project_id, label, building_code, footprint_geojson from buildings where project_id in (select id from projects where scope_id = :scope)",
            Map.of("scope", scope)
        );

        Map<String, List<Map<String, Object>>> buildingsByProject = new LinkedHashMap<>();
        for (Map<String, Object> row : buildingRows) {
            String projectId = stringVal(row.get("project_id"));
            if (projectId == null) continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.get("id"));
            item.put("label", row.get("label"));
            item.put("buildingCode", row.get("building_code"));
            item.put("geometry", row.get("footprint_geojson"));
            buildingsByProject.computeIfAbsent(projectId, k -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : projectRows) {
            String projectId = stringVal(row.get("id"));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.get("id"));
            item.put("ujCode", row.get("uj_code"));
            item.put("name", row.get("name"));
            item.put("landPlotGeometry", row.get("land_plot_geojson"));
            item.put("buildings", buildingsByProject.getOrDefault(projectId, List.of()));
            items.add(item);
        }

        return Map.of("items", items);
    }

    public Map<String, Object> appId(String projectId, String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        }
        var row = applications.findFirstByProjectIdAndScopeId(projectId, scope).orElse(null);
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found");
        return Map.of("applicationId", row.getId());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> externalApplications(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Scope is required");
        }
        return List.of(Map.of(
            "id", "EXT-10001",
            "source", "EPIGU",
            "externalId", "EP-2026-9912",
            "applicant", "ООО \"Golden House\"",
            "submissionDate", Instant.now().toString(),
            "cadastre", "10:10:10:10:10:0001",
            "address", "г. Ташкент, Шайхантахурский р-н, ул. Навои, 12",
            "status", "NEW",
            "scope", scope
        ));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        }

        List<Map<String, Object>> rows = queryList(
            "select status, workflow_substatus from applications where scope_id = :scope",
            Map.of("scope", scope)
        );

        Set<String> workSubstatuses = Set.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER");
        Map<String, Object> counts = new LinkedHashMap<>();
        counts.put("work", 0);
        counts.put("review", 0);
        counts.put("integration", 0);
        counts.put("pendingDecline", 0);
        counts.put("declined", 0);
        counts.put("registryApplications", 0);
        counts.put("registryComplexes", 0);

        for (Map<String, Object> row : rows) {
            String status = stringVal(row.get("status"));
            String sub = stringVal(row.get("workflow_substatus"));
            if ("IN_PROGRESS".equals(status) && workSubstatuses.contains(sub)) counts.compute("work", (k, v) -> (Integer) v + 1);
            if ("REVIEW".equals(sub)) counts.compute("review", (k, v) -> (Integer) v + 1);
            if ("INTEGRATION".equals(sub)) counts.compute("integration", (k, v) -> (Integer) v + 1);
            if ("PENDING_DECLINE".equals(sub)) counts.compute("pendingDecline", (k, v) -> (Integer) v + 1);
            if ("DECLINED".equals(status)) counts.compute("declined", (k, v) -> (Integer) v + 1);
            if ("COMPLETED".equals(status) || "DECLINED".equals(status)) counts.compute("registryApplications", (k, v) -> (Integer) v + 1);
            if ("COMPLETED".equals(status)) counts.compute("registryComplexes", (k, v) -> (Integer) v + 1);
        }

        return counts;
    }

    @Transactional
    public Map<String, Object> fromApplication(Map<String, Object> body) {
        String scope = stringVal(body == null ? null : body.get("scope"));
        if (scope == null || scope.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        }

        String projectId = stringValOr(body == null ? null : body.get("projectId"), UUID.randomUUID().toString());
        String projectName = stringValOr(body == null ? null : body.get("name"), "Без названия");

        var project = projects.findById(projectId).orElseGet(() -> {
            var p = new uz.reestrmkd.backendjpa.domain.ProjectEntity();
            p.setId(projectId);
            return p;
        });
        project.setName(projectName);
        project.setScopeId(scope);
        projects.save(project);

        var app = new uz.reestrmkd.backendjpa.domain.ApplicationEntity();
        app.setId(UUID.randomUUID().toString());
        app.setProjectId(projectId);
        app.setScopeId(scope);
        app.setStatus("IN_PROGRESS");
        app.setWorkflowSubstatus("DRAFT");
        applications.save(app);

        return Map.of("ok", true, "projectId", projectId, "applicationId", app.getId());
    }

    @Transactional
    public Map<String, Object> integrationStatus(String projectId, String status) {
        var p = projects.findById(projectId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found"));
        p.setIntegrationStatus(status);
        projects.save(p);
        return Map.of("ok", true);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> geometryCandidates(String projectId) {
        var rows = queryList("""
            select id, source_index, label, properties, geom_geojson, area_m2, is_selected_land_plot, assigned_building_id
            from project_geometry_candidates
            where project_id = :projectId
            order by source_index asc
            """, Map.of("projectId", projectId));

        List<Map<String, Object>> payload = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            payload.add(Map.of(
                "id", row.get("id"),
                "sourceIndex", row.get("source_index"),
                "label", row.get("label"),
                "properties", row.getOrDefault("properties", Map.of()),
                "geometry", row.get("geom_geojson"),
                "areaM2", row.get("area_m2"),
                "isSelectedLandPlot", Boolean.TRUE.equals(row.get("is_selected_land_plot")),
                "assignedBuildingId", row.get("assigned_building_id")
            ));
        }
        return payload;
    }

    @Transactional
    public Map<String, Object> importGeometryCandidates(String projectId, List<Map<String, Object>> candidates) {
        if (candidates == null || candidates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Candidates payload is required");
        }

        int imported = 0;
        for (Map<String, Object> candidate : candidates) {
            if (candidate == null || candidate.get("geometry") == null) continue;

            Query insert = em.createNativeQuery("""
                insert into project_geometry_candidates (id, project_id, source_index, label, properties, geom_geojson, updated_at)
                values (:id, :projectId, :sourceIndex, :label, cast(:properties as jsonb), cast(:geometry as jsonb), now())
                """);
            insert.setParameter("id", UUID.randomUUID().toString());
            insert.setParameter("projectId", projectId);
            insert.setParameter("sourceIndex", toInt(candidate.get("sourceIndex")));
            insert.setParameter("label", candidate.get("label") == null ? null : String.valueOf(candidate.get("label")));
            insert.setParameter("properties", toJson(candidate.getOrDefault("properties", Map.of())));
            insert.setParameter("geometry", toJson(candidate.get("geometry")));
            imported += insert.executeUpdate();
        }
        return Map.of("ok", true, "imported", imported);
    }

    @Transactional
    public Map<String, Object> selectLandPlot(String projectId, String candidateId) {
        if (candidateId == null || candidateId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateId is required");
        }

        Map<String, Object> row = queryOne("""
            select geom_geojson, area_m2 from project_geometry_candidates
            where id = :candidateId and project_id = :projectId
            """, Map.of("candidateId", candidateId, "projectId", projectId));

        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");

        execute("""
            update project_geometry_candidates
            set is_selected_land_plot = false, updated_at = now()
            where project_id = :projectId
            """, Map.of("projectId", projectId));

        execute("""
            update project_geometry_candidates
            set is_selected_land_plot = true, updated_at = now()
            where id = :candidateId and project_id = :projectId
            """, Map.of("candidateId", candidateId, "projectId", projectId));

        execute("""
            update projects
            set land_plot_geojson = cast(:geometry as jsonb), land_plot_area_m2 = :area, updated_at = now()
            where id = :projectId
            """, Map.of("geometry", toJson(row.get("geom_geojson")), "area", row.get("area_m2"), "projectId", projectId));

        return Map.of("ok", true, "areaM2", row.get("area_m2"));
    }

    @Transactional
    public Map<String, Object> unselectLandPlot(String projectId) {
        execute("""
            update project_geometry_candidates
            set is_selected_land_plot = false, updated_at = now()
            where project_id = :projectId
            """, Map.of("projectId", projectId));

        execute("""
            update projects
            set land_plot_geojson = null, land_plot_geom = null, land_plot_area_m2 = null, updated_at = now()
            where id = :projectId
            """, Map.of("projectId", projectId));

        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> deleteGeometryCandidate(String projectId, String candidateId) {
        int count = execute("delete from project_geometry_candidates where id = :candidateId and project_id = :projectId",
            Map.of("candidateId", candidateId, "projectId", projectId));
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> selectBuildingGeometry(String projectId, String buildingId, String candidateId) {
        if (candidateId == null || candidateId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "candidateId is required");
        }

        Map<String, Object> row = queryOne("""
            select area_m2 from project_geometry_candidates
            where id = :candidateId and project_id = :projectId
            """, Map.of("candidateId", candidateId, "projectId", projectId));
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Candidate not found");

        execute("""
            update project_geometry_candidates
            set assigned_building_id = :buildingId, updated_at = now()
            where id = :candidateId and project_id = :projectId
            """, Map.of("buildingId", buildingId, "candidateId", candidateId, "projectId", projectId));

        return Map.of("ok", true, "areaM2", row.get("area_m2"));
    }


    @Transactional(readOnly = true)
    public Map<String, Object> context(String projectId, String scope) {
        if (scope == null || scope.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");

        Map<String, Object> app = queryOne("select * from applications where project_id = :projectId and scope_id = :scope", Map.of("projectId", projectId, "scope", scope));
        Map<String, Object> project = queryOne("select * from projects where id = :projectId", Map.of("projectId", projectId));
        if (project == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");

        List<Map<String, Object>> participants = queryList("select * from project_participants where project_id = :projectId", Map.of("projectId", projectId));
        List<Map<String, Object>> documents = queryList("select * from project_documents where project_id = :projectId order by doc_date desc", Map.of("projectId", projectId));
        List<Map<String, Object>> buildings = queryList("select * from buildings where project_id = :projectId order by created_at asc", Map.of("projectId", projectId));
        List<String> buildingIds = buildings.stream().map(b -> stringVal(b.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> blocks = buildingIds.isEmpty() ? List.of() : queryList(
            "select * from building_blocks where building_id in (:buildingIds) order by created_at asc",
            Map.of("buildingIds", buildingIds)
        );
        List<String> blockIds = blocks.stream().map(b -> stringVal(b.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> constructions = blockIds.isEmpty() ? List.of() : queryList("select * from block_construction where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> engineering = blockIds.isEmpty() ? List.of() : queryList("select * from block_engineering where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> markers = blockIds.isEmpty() ? List.of() : queryList("select * from block_floor_markers where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> extensions = blockIds.isEmpty() ? List.of() : queryList("select * from block_extensions where parent_block_id in (:blockIds) order by created_at asc", Map.of("blockIds", blockIds));

        Map<String, Map<String, Object>> constructionByBlock = new HashMap<>();
        for (Map<String, Object> row : constructions) constructionByBlock.put(stringVal(row.get("block_id")), row);
        Map<String, Map<String, Object>> engineeringByBlock = new HashMap<>();
        for (Map<String, Object> row : engineering) engineeringByBlock.put(stringVal(row.get("block_id")), row);
        Map<String, List<Map<String, Object>>> markersByBlock = new HashMap<>();
        for (Map<String, Object> row : markers) {
            String blockId = stringVal(row.get("block_id"));
            if (blockId == null) continue;
            markersByBlock.computeIfAbsent(blockId, k -> new ArrayList<>()).add(row);
        }

        Map<String, List<Map<String, Object>>> extensionsByBlock = new HashMap<>();
        for (Map<String, Object> row : extensions) {
            String blockId = stringVal(row.get("parent_block_id"));
            if (blockId == null) continue;
            extensionsByBlock.computeIfAbsent(blockId, k -> new ArrayList<>()).add(row);
        }

        Map<String, List<Map<String, Object>>> blocksByBuilding = new HashMap<>();
        for (Map<String, Object> block : blocks) {
            String buildingId = stringVal(block.get("building_id"));
            String blockId = stringVal(block.get("id"));
            if (buildingId == null) continue;
            Map<String, Object> item = new LinkedHashMap<>(block);
            Map<String, Object> construction = constructionByBlock.get(blockId);
            Map<String, Object> eng = engineeringByBlock.get(blockId);
            item.put("block_construction", construction == null ? List.of() : List.of(construction));
            item.put("block_engineering", eng == null ? List.of() : List.of(eng));
            item.put("block_floor_markers", markersByBlock.getOrDefault(blockId, List.of()));
            item.put("block_extensions", extensionsByBlock.getOrDefault(blockId, List.of()));
            blocksByBuilding.computeIfAbsent(buildingId, k -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> buildingPayload = new ArrayList<>();
        for (Map<String, Object> b : buildings) {
            String bid = stringVal(b.get("id"));
            Map<String, Object> item = new LinkedHashMap<>(b);
            item.put("building_blocks", blocksByBuilding.getOrDefault(bid, List.of()));
            buildingPayload.add(item);
        }

        List<Map<String, Object>> history = app == null ? List.of() : queryList("select * from application_history where application_id = :appId order by created_at desc", Map.of("appId", app.get("id")));
        List<Map<String, Object>> steps = app == null ? List.of() : queryList("select * from application_steps where application_id = :appId", Map.of("appId", app.get("id")));

        return Map.of(
            "project", project,
            "application", app,
            "participants", participants,
            "documents", documents,
            "buildings", buildingPayload,
            "history", history,
            "steps", steps
        );
    }

    @Transactional
    public Map<String, Object> validateStep(String projectId, Map<String, Object> body) {
        String scope = stringVal(body == null ? null : body.get("scope"));
        String stepId = stringVal(body == null ? null : body.get("stepId"));
        if (scope == null || scope.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        if (stepId == null || stepId.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "stepId is required");

        var app = applications.findFirstByProjectIdAndScopeId(projectId, scope).orElse(null);
        if (app == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found");

        return Map.of("ok", true, "stepId", stepId, "errors", List.of());
    }

    @Transactional
    public Map<String, Object> contextBuildingSave(String projectId, Map<String, Object> body) {
        Map<String, Object> details = mapFrom(body == null ? null : body.get("buildingDetails"));
        Set<String> projectBuildingIds = queryList("select id from buildings where project_id = :projectId", Map.of("projectId", projectId))
            .stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());
        Set<String> projectBlockIds = queryList("""
            select bb.id
            from building_blocks bb
            join buildings b on b.id = bb.building_id
            where b.project_id = :projectId
            """, Map.of("projectId", projectId))
            .stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());

        for (Map.Entry<String, Object> entry : details.entrySet()) {
            String key = entry.getKey();
            if (key == null) continue;

            if (key.endsWith("_data")) {
                String buildingId = key.substring(0, key.length() - 5);
                Map<String, Object> data = mapFrom(entry.getValue());
                if (buildingId.isBlank() || data.isEmpty() || !projectBuildingIds.contains(buildingId)) continue;

                execute("""
                    update buildings
                    set category = coalesce(:category, category),
                        stage = coalesce(:stage, stage),
                        construction_type = coalesce(:constructionType, construction_type),
                        parking_type = coalesce(:parkingType, parking_type),
                        has_non_res_part = coalesce(:hasNonResPart, has_non_res_part),
                        updated_at = now()
                    where id = :buildingId and project_id = :projectId
                    """, Map.of(
                    "category", stringVal(data.get("category")),
                    "stage", stringVal(data.get("stage")),
                    "constructionType", stringVal(data.get("constructionType")),
                    "parkingType", stringVal(data.get("parkingType")),
                    "hasNonResPart", data.get("hasNonResPart") instanceof Boolean b ? b : null,
                    "buildingId", buildingId,
                    "projectId", projectId
                ));
                continue;
            }

            if (key.contains("_features")) {
                String buildingId = key.replace("_features", "");
                if (!projectBuildingIds.contains(buildingId)) continue;
                Map<String, Object> features = mapFrom(entry.getValue());
                List<Map<String, Object>> basements = toMapList(features.get("basements"));

                Set<String> keepBasementIds = new LinkedHashSet<>();
                for (Map<String, Object> basement : basements) {
                    String basementId = stringValOr(basement.get("id"), UUID.randomUUID().toString());
                    Integer depthRaw = nullableInt(basement.get("depth"));
                    if (depthRaw == null) continue;
                    int depth = normalizeDepth(depthRaw);

                    List<String> linkedBlocks = new ArrayList<>();
                    for (Object idObj : toList(basement.get("blocks"))) {
                        if (idObj != null) {
                            String id = String.valueOf(idObj);
                            if (id.length() == 36) linkedBlocks.add(id);
                        }
                    }
                    String singleBlockId = stringVal(basement.get("blockId"));
                    if (singleBlockId != null && singleBlockId.length() == 36) linkedBlocks.add(singleBlockId);
                    linkedBlocks = new ArrayList<>(new LinkedHashSet<>(linkedBlocks));

                    execute("""
                        insert into building_blocks(
                            id, building_id, label, type, is_basement_block,
                            linked_block_ids, basement_depth, basement_has_parking,
                            basement_parking_levels, basement_communications,
                            floors_count, floors_from, floors_to,
                            entrances_count, elevators_count, vehicle_entries, levels_depth,
                            light_structure_type, parent_blocks,
                            has_basement, has_attic, has_loft, has_roof_expl,
                            has_custom_address, custom_house_number, updated_at
                        )
                        values (
                            :id, :buildingId, :label, 'BAS', true,
                            cast(:linkedBlockIds as uuid[]), :depth, :hasParking,
                            cast(:parkingLevels as jsonb), cast(:communications as jsonb),
                            0, null, null,
                            :entrancesCount, 0, 0, 0,
                            null, cast(:parentBlocks as uuid[]),
                            false, false, false, false,
                            false, null, now()
                        )
                        on conflict (id) do update
                        set linked_block_ids = excluded.linked_block_ids,
                            basement_depth = excluded.basement_depth,
                            basement_has_parking = excluded.basement_has_parking,
                            basement_parking_levels = excluded.basement_parking_levels,
                            basement_communications = excluded.basement_communications,
                            entrances_count = excluded.entrances_count,
                            updated_at = now()
                        """, Map.of(
                        "id", basementId,
                        "buildingId", buildingId,
                        "label", "Подвал",
                        "linkedBlockIds", toPgUuidArrayLiteral(linkedBlocks),
                        "depth", depth,
                        "hasParking", Boolean.TRUE.equals(basement.get("hasParking")),
                        "parkingLevels", toJson(objectToMap(basement.get("parkingLevels"))),
                        "communications", toJson(objectToMap(basement.get("communications"))),
                        "entrancesCount", Math.min(10, Math.max(1, toInt(basement.get("entrancesCount")))),
                        "parentBlocks", toPgUuidArrayLiteral(List.of())
                    ));
                    keepBasementIds.add(basementId);
                    projectBlockIds.add(basementId);
                }

                List<Map<String, Object>> existing = queryList(
                    "select id from building_blocks where building_id = :buildingId and is_basement_block = true",
                    Map.of("buildingId", buildingId)
                );
                for (Map<String, Object> row : existing) {
                    String existingId = stringVal(row.get("id"));
                    if (existingId != null && !keepBasementIds.contains(existingId)) {
                        execute("delete from building_blocks where id = :id", Map.of("id", existingId));
                    }
                }
                continue;
            }

            String[] parts = key.split("_");
            String blockId = parts.length == 0 ? "" : parts[parts.length - 1];
            if (blockId.length() != 36 || !projectBlockIds.contains(blockId)) continue;

            Map<String, Object> block = mapFrom(entry.getValue());
            Map<String, Object> blockParams = new HashMap<>();
            blockParams.put("blockId", blockId);
            blockParams.put("floorsCount", nullableInt(block.get("floorsCount")));
            blockParams.put("entrancesCount", nullableInt(block.get("entrances")) == null ? nullableInt(block.get("inputs")) : nullableInt(block.get("entrances")));
            blockParams.put("elevatorsCount", nullableInt(block.get("elevators")));
            blockParams.put("vehicleEntries", nullableInt(block.get("vehicleEntries")));
            blockParams.put("levelsDepth", nullableInt(block.get("levelsDepth")));
            blockParams.put("lightStructureType", stringVal(block.get("lightStructureType")));
            blockParams.put("floorsFrom", nullableInt(block.get("floorsFrom")));
            blockParams.put("floorsTo", nullableInt(block.get("floorsTo")));
            blockParams.put("hasBasement", Boolean.TRUE.equals(block.get("hasBasementFloor")));
            blockParams.put("hasAttic", Boolean.TRUE.equals(block.get("hasAttic")));
            blockParams.put("hasLoft", Boolean.TRUE.equals(block.get("hasLoft")));
            blockParams.put("hasRoofExpl", Boolean.TRUE.equals(block.get("hasExploitableRoof")));
            blockParams.put("hasCustomAddress", Boolean.TRUE.equals(block.get("hasCustomAddress")));
            blockParams.put("customHouseNumber", stringVal(block.get("customHouseNumber")));
            blockParams.put("addressId", stringVal(block.get("addressId")));
            if (blockParams.get("addressId") == null && Boolean.TRUE.equals(blockParams.get("hasCustomAddress"))) {
                Map<String, Object> b = queryOne("select address_id from buildings where id = (select building_id from building_blocks where id = :id)", Map.of("id", blockId));
                String baseAddressId = b == null ? null : stringVal(b.get("address_id"));
                if (baseAddressId != null) {
                    blockParams.put("addressId", deriveBlockAddressId(baseAddressId, stringVal(block.get("customHouseNumber"))));
                }
            }
            List<String> parentBlocks = new ArrayList<>();
            for (Object pb : toList(block.get("parentBlocks"))) {
                if (pb != null) {
                    String id = String.valueOf(pb);
                    if (id.length() == 36 && projectBlockIds.contains(id)) parentBlocks.add(id);
                }
            }
            blockParams.put("parentBlocks", toPgUuidArrayLiteral(new ArrayList<>(new LinkedHashSet<>(parentBlocks))));

            execute("""
                update building_blocks
                set floors_count = coalesce(:floorsCount, floors_count),
                    entrances_count = coalesce(:entrancesCount, entrances_count),
                    elevators_count = coalesce(:elevatorsCount, elevators_count),
                    vehicle_entries = coalesce(:vehicleEntries, vehicle_entries),
                    levels_depth = coalesce(:levelsDepth, levels_depth),
                    light_structure_type = coalesce(:lightStructureType, light_structure_type),
                    floors_from = :floorsFrom,
                    floors_to = :floorsTo,
                    has_basement = :hasBasement,
                    has_attic = :hasAttic,
                    has_loft = :hasLoft,
                    has_roof_expl = :hasRoofExpl,
                    has_custom_address = :hasCustomAddress,
                    custom_house_number = :customHouseNumber,
                    address_id = coalesce(cast(:addressId as uuid), address_id),
                    parent_blocks = cast(:parentBlocks as uuid[]),
                    updated_at = now()
                where id = :blockId
                """, blockParams);

            Integer entrancesCountRaw = nullableInt(blockParams.get("entrancesCount"));
            if (entrancesCountRaw != null) {
                int entrancesCount = Math.max(0, entrancesCountRaw);
                List<Map<String, Object>> existingEntrances = queryList(
                    "select id, number from entrances where block_id = :blockId",
                    Map.of("blockId", blockId)
                );
                Map<Integer, String> existingByNumber = new HashMap<>();
                for (Map<String, Object> er : existingEntrances) {
                    existingByNumber.put(toInt(er.get("number")), stringVal(er.get("id")));
                }

                Set<Integer> keepNumbers = new LinkedHashSet<>();
                for (int n = 1; n <= entrancesCount; n++) {
                    keepNumbers.add(n);
                    if (!existingByNumber.containsKey(n)) {
                        execute("""
                            insert into entrances(id, block_id, number, updated_at)
                            values (:id, :blockId, :number, now())
                            """, Map.of("id", UUID.randomUUID().toString(), "blockId", blockId, "number", n));
                    }
                }
                for (Map<String, Object> er : existingEntrances) {
                    int number = toInt(er.get("number"));
                    if (!keepNumbers.contains(number)) {
                        execute("delete from entrances where id = :id", Map.of("id", er.get("id")));
                    }
                }

                if (entrancesCount == 0) {
                    execute("delete from entrance_matrix where block_id = :blockId", Map.of("blockId", blockId));
                } else {
                    execute("delete from entrance_matrix where block_id = :blockId and entrance_number > :entrancesCount", Map.of("blockId", blockId, "entrancesCount", entrancesCount));
                    execute("""
                        delete from entrance_matrix m
                        where m.block_id = :blockId
                          and not exists (
                            select 1 from floors f
                            where f.id = m.floor_id and f.block_id = :blockId
                          )
                        """, Map.of("blockId", blockId));
                    List<Map<String, Object>> floorsForBlock = queryList("select id from floors where block_id = :blockId", Map.of("blockId", blockId));
                    for (Map<String, Object> floor : floorsForBlock) {
                        String floorId = stringVal(floor.get("id"));
                        if (floorId == null) continue;
                        for (int n = 1; n <= entrancesCount; n++) {
                            execute("""
                                insert into entrance_matrix(id, block_id, floor_id, entrance_number, flats_count, commercial_count, mop_count, updated_at)
                                values (:id, :blockId, :floorId, :entranceNumber, 0, 0, 0, now())
                                on conflict (block_id, floor_id, entrance_number) do nothing
                                """, Map.of(
                                "id", UUID.randomUUID().toString(),
                                "blockId", blockId,
                                "floorId", floorId,
                                "entranceNumber", n
                            ));
                        }
                    }
                }
            }

            Set<String> technical = toMarkerSet(block.get("technicalFloors"), true);
            Set<String> commercial = toMarkerSet(block.get("commercialFloors"), false);
            Set<String> markerKeys = new LinkedHashSet<>();
            markerKeys.addAll(technical);
            markerKeys.addAll(commercial);

            execute("delete from block_floor_markers where block_id = :blockId", Map.of("blockId", blockId));
            for (String markerKey : markerKeys) {
                String markerType = markerKey.startsWith("basement_") ? "basement"
                    : markerKey.contains("-Т") ? "technical"
                    : Set.of("attic", "loft", "roof", "tsokol").contains(markerKey) ? "special" : "floor";
                Integer floorIndex = markerKey.contains("-Т") ? nullableInt(markerKey.replace("-Т", ""))
                    : markerKey.matches("^-?\\d+$") ? nullableInt(markerKey) : null;
                Integer parentFloorIndex = markerKey.contains("-Т") ? nullableInt(markerKey.replace("-Т", "")) : null;

                Map<String, Object> mp = new HashMap<>();
                mp.put("blockId", blockId);
                mp.put("markerKey", markerKey);
                mp.put("markerType", markerType);
                mp.put("floorIndex", floorIndex);
                mp.put("parentFloorIndex", parentFloorIndex);
                mp.put("isTechnical", technical.contains(markerKey));
                mp.put("isCommercial", commercial.contains(markerKey));
                execute("""
                    insert into block_floor_markers(block_id, marker_key, marker_type, floor_index, parent_floor_index, is_technical, is_commercial, updated_at)
                    values (:blockId, :markerKey, :markerType, :floorIndex, :parentFloorIndex, :isTechnical, :isCommercial, now())
                    """, mp);
            }

            if (block.get("foundation") != null || block.get("walls") != null || block.get("slabs") != null || block.get("roof") != null || block.get("seismicity") != null) {
                execute("""
                    insert into block_construction(block_id, foundation, walls, slabs, roof, seismicity, updated_at)
                    values (:blockId, :foundation, :walls, :slabs, :roof, :seismicity, now())
                    on conflict (block_id) do update
                    set foundation = excluded.foundation,
                        walls = excluded.walls,
                        slabs = excluded.slabs,
                        roof = excluded.roof,
                        seismicity = excluded.seismicity,
                        updated_at = now()
                    """, Map.of(
                    "blockId", blockId,
                    "foundation", stringVal(block.get("foundation")),
                    "walls", stringVal(block.get("walls")),
                    "slabs", stringVal(block.get("slabs")),
                    "roof", stringVal(block.get("roof")),
                    "seismicity", nullableInt(block.get("seismicity"))
                ));
            }

            Map<String, Object> eng = mapFrom(block.get("engineering"));
            if (!eng.isEmpty()) {
                execute("""
                    insert into block_engineering(block_id, has_electricity, has_water, has_hot_water, has_ventilation, has_firefighting, has_lowcurrent, has_sewerage, has_gas, has_heating, updated_at)
                    values (:blockId, :e, :w, :hw, :v, :f, :l, :s, :g, :h, now())
                    on conflict (block_id) do update
                    set has_electricity = excluded.has_electricity,
                        has_water = excluded.has_water,
                        has_hot_water = excluded.has_hot_water,
                        has_ventilation = excluded.has_ventilation,
                        has_firefighting = excluded.has_firefighting,
                        has_lowcurrent = excluded.has_lowcurrent,
                        has_sewerage = excluded.has_sewerage,
                        has_gas = excluded.has_gas,
                        has_heating = excluded.has_heating,
                        updated_at = now()
                    """, Map.of(
                    "blockId", blockId,
                    "e", Boolean.TRUE.equals(eng.get("electricity")),
                    "w", Boolean.TRUE.equals(eng.get("hvs")),
                    "hw", Boolean.TRUE.equals(eng.get("gvs")),
                    "v", Boolean.TRUE.equals(eng.get("ventilation")),
                    "f", Boolean.TRUE.equals(eng.get("firefighting")),
                    "l", Boolean.TRUE.equals(eng.get("lowcurrent")),
                    "s", Boolean.TRUE.equals(eng.get("sewerage")),
                    "g", Boolean.TRUE.equals(eng.get("gas")),
                    "h", Boolean.TRUE.equals(eng.get("heating"))
                ));
            }
        }

        execute("update projects set updated_at = now() where id = :projectId", Map.of("projectId", projectId));
        return Map.of("ok", true, "projectId", projectId);
    }

    @Transactional
    public Map<String, Object> contextMetaSave(String projectId, Map<String, Object> body) {
        String scope = stringVal(body == null ? null : body.get("scope"));
        if (scope == null || scope.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");

        Map<String, Object> complexInfo = mapFrom(body == null ? null : body.get("complexInfo"));
        if (!complexInfo.isEmpty()) {
            Map<String, Object> projectParams = new HashMap<>();
            projectParams.put("name", stringVal(complexInfo.get("name")));
            projectParams.put("status", stringVal(complexInfo.get("status")));
            projectParams.put("region", stringVal(complexInfo.get("region")));
            projectParams.put("district", stringVal(complexInfo.get("district")));
            projectParams.put("street", stringVal(complexInfo.get("street")));
            projectParams.put("dateStartProject", complexInfo.get("dateStartProject"));
            projectParams.put("dateEndProject", complexInfo.get("dateEndProject"));
            projectParams.put("dateStartFact", complexInfo.get("dateStartFact"));
            projectParams.put("dateEndFact", complexInfo.get("dateEndFact"));
            projectParams.put("addressId", stringVal(complexInfo.get("addressId")));
            projectParams.put("hasAddressId", complexInfo.containsKey("addressId"));
            projectParams.put("projectId", projectId);

            execute("""
                update projects
                set name = coalesce(:name, name),
                    construction_status = coalesce(:status, construction_status),
                    region = coalesce(:region, region),
                    district = coalesce(:district, district),
                    address = coalesce(:street, address),
                    address_id = case when :hasAddressId then cast(:addressId as uuid) else address_id end,
                    date_start_project = :dateStartProject,
                    date_end_project = :dateEndProject,
                    date_start_fact = :dateStartFact,
                    date_end_fact = :dateEndFact,
                    updated_at = now()
                where id = :projectId
                """, projectParams);
        }

        Map<String, Object> applicationInfo = mapFrom(body == null ? null : body.get("applicationInfo"));
        String applicationId = null;
        if (!applicationInfo.isEmpty()) {
            Map<String, Object> app = queryOne("select id from applications where project_id = :projectId", Map.of("projectId", projectId));
            if (app == null) {
                applicationId = UUID.randomUUID().toString();
                execute("""
                    insert into applications(id, project_id, scope_id, internal_number, external_source, status, workflow_substatus, current_step, current_stage, submission_date, created_at, updated_at)
                    values (:id, :projectId, :scope, :internalNumber, 'MIGRATION_FIX', :status, :substatus, :currentStep, :currentStage, now(), now(), now())
                    """, Map.of(
                    "id", applicationId,
                    "projectId", projectId,
                    "scope", scope,
                    "internalNumber", "AUTO-" + (System.currentTimeMillis() % 1000000),
                    "status", stringValOr(applicationInfo.get("status"), "IN_PROGRESS"),
                    "substatus", stringValOr(applicationInfo.get("workflowSubstatus"), "DRAFT"),
                    "currentStep", toInt(applicationInfo.get("currentStepIndex")),
                    "currentStage", toInt(applicationInfo.get("currentStage"))
                ));
            } else {
                applicationId = stringVal(app.get("id"));
            }

            execute("""
                update applications
                set status = coalesce(:status, status),
                    workflow_substatus = coalesce(:workflowSubstatus, workflow_substatus),
                    current_step = coalesce(:currentStep, current_step),
                    current_stage = coalesce(:currentStage, current_stage),
                    requested_decline_reason = :requestedDeclineReason,
                    requested_decline_step = :requestedDeclineStep,
                    requested_decline_by = :requestedDeclineBy,
                    requested_decline_at = :requestedDeclineAt,
                    updated_at = now()
                where id = :applicationId
                """, Map.of(
                "status", stringVal(applicationInfo.get("status")),
                "workflowSubstatus", stringVal(applicationInfo.get("workflowSubstatus")),
                "currentStep", applicationInfo.get("currentStepIndex"),
                "currentStage", applicationInfo.get("currentStage"),
                "requestedDeclineReason", applicationInfo.get("requestedDeclineReason"),
                "requestedDeclineStep", applicationInfo.get("requestedDeclineStep"),
                "requestedDeclineBy", applicationInfo.get("requestedDeclineBy"),
                "requestedDeclineAt", applicationInfo.get("requestedDeclineAt"),
                "applicationId", applicationId
            ));

            Object completedStepsObj = applicationInfo.get("completedSteps");
            if (completedStepsObj instanceof List<?> completedSteps) {
                for (Object idxObj : completedSteps) {
                    int idx = toInt(idxObj);
                    if (idx < 0) continue;
                    execute("""
                        insert into application_steps(application_id, step_index, is_completed, updated_at)
                        values (:applicationId, :stepIndex, true, now())
                        on conflict (application_id, step_index) do update
                        set is_completed = true, updated_at = now()
                        """, Map.of("applicationId", applicationId, "stepIndex", idx));
                }
            }

            Object historyObj = applicationInfo.get("history");
            if (historyObj instanceof List<?> historyList && !historyList.isEmpty() && historyList.get(0) instanceof Map<?, ?> h0) {
                @SuppressWarnings("unchecked")
                Map<String, Object> last = (Map<String, Object>) h0;
                Object dateValue = last.get("date");
                if (dateValue != null) {
                    java.time.Instant eventTime;
                    try {
                        eventTime = java.time.Instant.parse(String.valueOf(dateValue));
                    } catch (Exception ignored) {
                        eventTime = java.time.Instant.now();
                    }
                    long ageMs = java.time.Duration.between(eventTime, java.time.Instant.now()).toMillis();
                    if (ageMs >= 0 && ageMs < 5000) {
                        execute("""
                            insert into application_history(application_id, action, prev_status, next_status, user_name, comment, created_at)
                            values (:applicationId, :action, :prevStatus, :nextStatus, :userName, :comment, :createdAt)
                            """, Map.of(
                            "applicationId", applicationId,
                            "action", stringVal(last.get("action")),
                            "prevStatus", stringVal(last.get("prevStatus")),
                            "nextStatus", stringValOr(last.get("nextStatus"), stringVal(applicationInfo.get("status"))),
                            "userName", stringVal(last.get("user")),
                            "comment", stringVal(last.get("comment")),
                            "createdAt", String.valueOf(dateValue)
                        ));
                    }
                }
            }
        }

        return Map.of("ok", true, "projectId", projectId, "applicationId", applicationId);
    }

    @Transactional
    public Map<String, Object> stepBlockStatusesSave(String projectId, Map<String, Object> body) {
        String scope = stringVal(body == null ? null : body.get("scope"));
        int stepIndex = toInt(body == null ? null : body.get("stepIndex"));
        if (scope == null || scope.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        if (stepIndex < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "stepIndex must be a non-negative number");

        var app = applications.findFirstByProjectIdAndScopeId(projectId, scope).orElse(null);
        if (app == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Application not found");

        Map<String, Object> statuses = mapFrom(body == null ? null : body.get("statuses"));
        execute("""
            insert into application_steps (application_id, step_index, block_statuses, updated_at)
            values (:applicationId, :stepIndex, cast(:statuses as jsonb), now())
            on conflict (application_id, step_index) do update
            set block_statuses = excluded.block_statuses, updated_at = now()
            """, Map.of(
            "applicationId", app.getId(),
            "stepIndex", stepIndex,
            "statuses", toJson(statuses)
        ));

        return Map.of("applicationId", app.getId(), "stepIndex", stepIndex, "blockStatuses", statuses);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> contextRegistryDetails(String projectId) {
        List<Map<String, Object>> blockRows = queryList(
            "select bb.id from building_blocks bb join buildings b on b.id = bb.building_id where b.project_id = :projectId",
            Map.of("projectId", projectId)
        );
        List<String> blockIds = blockRows.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        if (blockIds.isEmpty()) {
            return Map.of("markerRows", List.of(), "floors", List.of(), "entrances", List.of(), "matrix", List.of(), "units", List.of(), "mops", List.of());
        }

        List<Map<String, Object>> markerRows = queryList("select block_id, marker_key, is_technical, is_commercial from block_floor_markers where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> floors = queryList("select id, block_id, floor_key, label, index, floor_type, height, area_proj, area_fact, is_duplex, parent_floor_index, is_commercial, is_technical, is_stylobate, is_basement, is_attic, is_loft, is_roof, basement_id from floors where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<String> floorIds = floors.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();

        List<Map<String, Object>> entrances = queryList("select id, block_id, number from entrances where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> matrix = queryList("select floor_id, entrance_number, flats_count, commercial_count, mop_count from entrance_matrix where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> units = floorIds.isEmpty() ? List.of() : queryList("select id, floor_id, entrance_id, number, unit_type, has_mezzanine, mezzanine_type, total_area, living_area, useful_area, rooms_count, status, cadastre_number from units where floor_id in (:floorIds)", Map.of("floorIds", floorIds));
        List<Map<String, Object>> mops = floorIds.isEmpty() ? List.of() : queryList("select id, floor_id, entrance_id, type, area, height from common_areas where floor_id in (:floorIds)", Map.of("floorIds", floorIds));

        return Map.of("markerRows", markerRows, "floors", floors, "entrances", entrances, "matrix", matrix, "units", units, "mops", mops);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> passport(String projectId) {
        Map<String, Object> project = queryOne("select * from projects where id = :projectId", Map.of("projectId", projectId));
        if (project == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        var participants = queryList("select * from project_participants where project_id = :projectId", Map.of("projectId", projectId));
        var docs = queryList("select * from project_documents where project_id = :projectId order by doc_date desc", Map.of("projectId", projectId));

        Map<String, Object> participantsMap = new LinkedHashMap<>();
        for (Map<String, Object> part : participants) {
            String role = stringVal(part.get("role"));
            if (role == null) continue;
            participantsMap.put(role, Map.of(
                "id", part.get("id"),
                "name", part.get("name"),
                "inn", part.get("inn"),
                "role", role
            ));
        }

        List<Map<String, Object>> documents = new ArrayList<>();
        for (Map<String, Object> d : docs) {
            documents.add(Map.of(
                "id", d.get("id"),
                "name", d.get("name"),
                "type", d.get("doc_type"),
                "date", d.get("doc_date"),
                "number", d.get("doc_number"),
                "url", d.get("file_url")
            ));
        }

        Map<String, Object> complexInfo = new LinkedHashMap<>();
        complexInfo.put("name", project.get("name"));
        complexInfo.put("ujCode", project.get("uj_code"));
        complexInfo.put("status", project.get("construction_status"));
        complexInfo.put("region", project.get("region"));
        complexInfo.put("district", project.get("district"));
        complexInfo.put("street", project.get("address"));
        complexInfo.put("addressId", project.get("address_id"));
        complexInfo.put("landmark", project.get("landmark"));
        complexInfo.put("dateStartProject", project.get("date_start_project"));
        complexInfo.put("dateEndProject", project.get("date_end_project"));
        complexInfo.put("dateStartFact", project.get("date_start_fact"));
        complexInfo.put("dateEndFact", project.get("date_end_fact"));

        Map<String, Object> cadastre = new LinkedHashMap<>();
        cadastre.put("number", project.get("cadastre_number"));
        cadastre.put("area", project.get("land_plot_area_m2"));

        Map<String, Object> landPlot = new LinkedHashMap<>();
        landPlot.put("geometry", project.get("land_plot_geojson"));
        landPlot.put("areaM2", project.get("land_plot_area_m2"));

        return Map.of(
            "complexInfo", complexInfo,
            "cadastre", cadastre,
            "landPlot", landPlot,
            "participants", participantsMap,
            "documents", documents
        );
    }

    @Transactional
    public Map<String, Object> updatePassport(String projectId, Map<String, Object> body) {
        Map<String, Object> info = mapFrom(body == null ? null : body.get("info"));
        Map<String, Object> cadastreData = mapFrom(body == null ? null : body.get("cadastreData"));
        Map<String, Object> params = new HashMap<>();
        params.put("name", info.get("name"));
        params.put("status", info.get("status"));
        params.put("region", info.get("region"));
        params.put("district", info.get("district"));
        params.put("street", info.get("street"));
        params.put("addressId", stringVal(info.get("addressId")));
        params.put("hasAddressId", info.containsKey("addressId"));
        params.put("landmark", info.get("landmark"));
        params.put("dateStartProject", info.get("dateStartProject"));
        params.put("dateEndProject", info.get("dateEndProject"));
        params.put("dateStartFact", info.get("dateStartFact"));
        params.put("dateEndFact", info.get("dateEndFact"));
        params.put("cadastreNumber", cadastreData.get("number"));
        params.put("landPlotArea", cadastreData.get("area"));
        params.put("projectId", projectId);

        execute("""
            update projects
            set name = :name,
                construction_status = :status,
                region = :region,
                district = :district,
                address = :street,
                address_id = case when :hasAddressId then cast(:addressId as uuid) else address_id end,
                landmark = :landmark,
                date_start_project = :dateStartProject,
                date_end_project = :dateEndProject,
                date_start_fact = :dateStartFact,
                date_end_fact = :dateEndFact,
                cadastre_number = :cadastreNumber,
                land_plot_area_m2 = :landPlotArea,
                updated_at = now()
            where id = :projectId
            """, params);
        Map<String, Object> row = queryOne("select * from projects where id = :projectId", Map.of("projectId", projectId));
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
        return row;
    }

    @Transactional
    public Map<String, Object> participants(String projectId, String role, Map<String, Object> body) {
        Map<String, Object> data = mapFrom(body == null ? null : body.get("data"));
        String participantId = stringValOr(data.get("id"), UUID.randomUUID().toString());
        execute("""
            insert into project_participants (id, project_id, role, name, inn, updated_at)
            values (:id, :projectId, :role, :name, :inn, now())
            on conflict (id) do update
            set role = excluded.role, name = excluded.name, inn = excluded.inn, updated_at = now()
            """, Map.of(
            "id", participantId,
            "projectId", projectId,
            "role", role,
            "name", stringValOr(data.get("name"), ""),
            "inn", stringValOr(data.get("inn"), "")
        ));
        Map<String, Object> row = queryOne("select * from project_participants where id = :id", Map.of("id", participantId));
        return row == null ? Map.of("id", participantId) : row;
    }

    @Transactional
    public Map<String, Object> documents(String projectId, Map<String, Object> body) {
        Map<String, Object> doc = mapFrom(body == null ? null : body.get("doc"));
        String id = stringValOr(doc.get("id"), UUID.randomUUID().toString());
        execute("""
            insert into project_documents (id, project_id, name, doc_type, doc_date, doc_number, file_url, updated_at)
            values (:id, :projectId, :name, :docType, :docDate, :docNumber, :fileUrl, now())
            on conflict (id) do update
            set name = excluded.name,
                doc_type = excluded.doc_type,
                doc_date = excluded.doc_date,
                doc_number = excluded.doc_number,
                file_url = excluded.file_url,
                updated_at = now()
            """, Map.of(
            "id", id,
            "projectId", projectId,
            "name", stringValOr(doc.get("name"), ""),
            "docType", stringValOr(doc.get("type"), ""),
            "docDate", doc.get("date"),
            "docNumber", stringValOr(doc.get("number"), ""),
            "fileUrl", stringVal(doc.get("url"))
        ));
        Map<String, Object> row = queryOne("select * from project_documents where id = :id", Map.of("id", id));
        return row == null ? Map.of("id", id) : row;
    }

    @Transactional
    public Map<String, Object> deleteDoc(String documentId) {
        int deleted = execute("delete from project_documents where id = :id", Map.of("id", documentId));
        if (deleted == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Document not found");
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> deleteProject(String projectId, String scope) {
        if (scope == null || scope.isBlank()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required");
        execute("delete from projects where id = :id and scope_id = :scope", Map.of("id", projectId, "scope", scope));
        return Map.of("ok", true);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> integrationGet(String projectId) {
        Map<String, Object> row = queryOne("select integration_status from projects where id = :id", Map.of("id", projectId));
        return Map.of("integrationStatus", row == null ? null : row.get("integration_status"));
    }

    @Transactional(readOnly = true)
    public Map<String, Object> parkingCounts(String projectId) {
        Map<String, Object> row = queryOne("""
            select count(1) as parking_places
            from units u
            join floors f on f.id = u.floor_id
            join building_blocks b on b.id = f.block_id
            join buildings g on g.id = b.building_id
            where g.project_id = :projectId and u.unit_type = 'parking'
            """, Map.of("projectId", projectId));
        return Map.of("parkingPlaces", row == null ? 0 : toInt(row.get("parking_places")));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> buildingsSummary() {
        return queryList("select * from buildings order by created_at desc", Map.of());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> basements(String projectId) {
        List<Map<String, Object>> rows = queryList("""
            select bb.id, bb.building_id, bb.linked_block_ids, bb.basement_depth, bb.basement_has_parking,
                   bb.basement_parking_levels, bb.basement_communications, bb.entrances_count
            from building_blocks bb
            join buildings b on b.id = bb.building_id
            where b.project_id = :projectId and bb.is_basement_block = true
            """, Map.of("projectId", projectId));

        List<Map<String, Object>> payload = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            List<?> linkedBlocks = toList(row.get("linked_block_ids"));
            int depth = normalizeDepth(toInt(row.get("basement_depth")));
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.get("id"));
            item.put("buildingId", row.get("building_id"));
            item.put("blockId", linkedBlocks.isEmpty() ? null : linkedBlocks.get(0));
            item.put("blocks", linkedBlocks);
            item.put("depth", depth);
            item.put("hasParking", Boolean.TRUE.equals(row.get("basement_has_parking")));
            item.put("parkingLevels", objectToMap(row.get("basement_parking_levels")));
            item.put("communications", objectToMap(row.get("basement_communications")));
            item.put("entrancesCount", Math.min(10, Math.max(1, toInt(row.get("entrances_count")))));
            payload.add(item);
        }
        return payload;
    }

    @Transactional
    public Map<String, Object> updateBasementLevel(String basementId, Integer level, Map<String, Object> body) {
        int parsedLevel = level == null ? 0 : level;
        if (parsedLevel < 1 || parsedLevel > 10) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "level must be integer in range [1..10]");
        }

        Map<String, Object> row = queryOne("""
            select basement_depth, basement_parking_levels
            from building_blocks
            where id = :id and is_basement_block = true
            """, Map.of("id", basementId));
        if (row == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Basement block not found");

        int basementDepth = normalizeDepth(toInt(row.get("basement_depth")));
        if (parsedLevel > basementDepth) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "level must be <= basement depth (" + basementDepth + ")");
        }

        Map<String, Object> levels = new LinkedHashMap<>(objectToMap(row.get("basement_parking_levels")));
        levels.put(String.valueOf(parsedLevel), Boolean.TRUE.equals(body == null ? null : body.get("isEnabled")));

        execute("""
            update building_blocks
            set basement_parking_levels = cast(:levels as jsonb), updated_at = now()
            where id = :id and is_basement_block = true
            """, Map.of("levels", toJson(levels), "id", basementId));
        return Map.of("ok", true);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> fullRegistry(String projectId) {
        Map<String, Object> projectRow = queryOne("select address_id from projects where id = :projectId", Map.of("projectId", projectId));
        String projectAddressId = projectRow == null ? null : stringVal(projectRow.get("address_id"));

        List<Map<String, Object>> buildings = queryList("select * from buildings where project_id = :projectId", Map.of("projectId", projectId));
        if (buildings.isEmpty()) {
            return Map.of("buildings", List.of(), "units", List.of());
        }

        List<String> buildingIds = buildings.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> blocks = queryList("select * from building_blocks where building_id in (:buildingIds)", Map.of("buildingIds", buildingIds));
        List<String> blockIds = blocks.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> extensions = blockIds.isEmpty() ? List.of() : queryList(
            "select * from block_extensions where parent_block_id in (:blockIds) order by created_at asc",
            Map.of("blockIds", blockIds)
        );
        Map<String, List<Map<String, Object>>> extensionsByBlockId = new HashMap<>();
        for (Map<String, Object> ext : extensions) {
            String parentBlockId = stringVal(ext.get("parent_block_id"));
            if (parentBlockId == null) continue;
            extensionsByBlockId.computeIfAbsent(parentBlockId, k -> new ArrayList<>()).add(ext);
        }

        List<Map<String, Object>> floors = blockIds.isEmpty() ? List.of() : queryList("select * from floors where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<Map<String, Object>> entrances = blockIds.isEmpty() ? List.of() : queryList("select id, block_id, number from entrances where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<String> floorIds = floors.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> units = floorIds.isEmpty() ? List.of() : queryList("select * from units where floor_id in (:floorIds) order by id asc", Map.of("floorIds", floorIds));
        List<String> unitIds = units.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> rooms = unitIds.isEmpty() ? List.of() : queryList("select * from rooms where unit_id in (:unitIds)", Map.of("unitIds", unitIds));

        Map<String, String> floorToBlock = new HashMap<>();
        for (Map<String, Object> floor : floors) {
            floorToBlock.put(stringVal(floor.get("id")), stringVal(floor.get("block_id")));
        }
        Map<String, String> blockToBuilding = new HashMap<>();
        for (Map<String, Object> block : blocks) {
            blockToBuilding.put(stringVal(block.get("id")), stringVal(block.get("building_id")));
        }
        Map<String, Object> buildingCodeById = new HashMap<>();
        Map<String, String> buildingAddressById = new HashMap<>();
        for (Map<String, Object> b : buildings) {
            String buildingId = stringVal(b.get("id"));
            buildingCodeById.put(buildingId, b.get("building_code"));
            buildingAddressById.put(buildingId, stringVal(b.get("address_id")));
        }
        Map<String, String> blockAddressById = new HashMap<>();
        for (Map<String, Object> block : blocks) {
            blockAddressById.put(stringVal(block.get("id")), stringVal(block.get("address_id")));
        }

        List<Map<String, Object>> payloadBuildings = new ArrayList<>();
        for (Map<String, Object> b : buildings) {
            Map<String, Object> item = new LinkedHashMap<>(b);
            item.put("label", b.get("label"));
            item.put("houseNumber", b.get("house_number"));
            item.put("buildingCode", b.get("building_code"));
            item.put("addressId", b.get("address_id"));
            item.put("effectiveAddressId", b.get("address_id") == null ? projectAddressId : b.get("address_id"));
            payloadBuildings.add(item);
        }

        List<Map<String, Object>> payloadBlocks = new ArrayList<>();
        for (Map<String, Object> block : blocks) {
            Map<String, Object> item = new LinkedHashMap<>(block);
            item.put("tabLabel", block.get("label"));
            item.put("buildingId", block.get("building_id"));
            item.put("isBasementBlock", Boolean.TRUE.equals(block.get("is_basement_block")));
            item.put("linkedBlockIds", block.get("linked_block_ids"));
            item.put("addressId", block.get("address_id"));
            String blockBuildingId = stringVal(block.get("building_id"));
            String blockAddressId = stringVal(block.get("address_id"));
            item.put("effectiveAddressId", blockAddressId != null ? blockAddressId : (buildingAddressById.get(blockBuildingId) != null ? buildingAddressById.get(blockBuildingId) : projectAddressId));
            item.put("extensions", extensionsByBlockId.getOrDefault(stringVal(block.get("id")), List.of()).stream().map(ext -> {
                Map<String, Object> extPayload = new LinkedHashMap<>();
                extPayload.put("id", ext.get("id"));
                extPayload.put("label", ext.get("label"));
                extPayload.put("extensionType", ext.get("extension_type"));
                extPayload.put("floorsCount", ext.get("floors_count"));
                extPayload.put("startFloorIndex", ext.get("start_floor_index"));
                return extPayload;
            }).toList());
            payloadBlocks.add(item);
        }

        List<Map<String, Object>> payloadFloors = new ArrayList<>();
        for (Map<String, Object> floor : floors) {
            Map<String, Object> item = new LinkedHashMap<>(floor);
            item.put("blockId", floor.get("block_id"));
            item.put("areaProj", floor.get("area_proj"));
            item.put("areaFact", floor.get("area_fact"));
            payloadFloors.add(item);
        }

        List<Map<String, Object>> payloadEntrances = new ArrayList<>();
        for (Map<String, Object> e : entrances) {
            payloadEntrances.add(Map.of(
                "id", e.get("id"),
                "blockId", e.get("block_id"),
                "number", e.get("number")
            ));
        }

        Map<String, List<Map<String, Object>>> roomsByUnit = new HashMap<>();
        for (Map<String, Object> room : rooms) {
            String unitId = stringVal(room.get("unit_id"));
            if (unitId == null) continue;
            Map<String, Object> mapped = new LinkedHashMap<>();
            mapped.put("id", room.get("id"));
            mapped.put("type", room.get("room_type"));
            mapped.put("label", room.get("name"));
            mapped.put("area", room.get("area"));
            mapped.put("height", room.get("room_height"));
            mapped.put("level", room.get("level"));
            mapped.put("isMezzanine", Boolean.TRUE.equals(room.get("is_mezzanine")));
            roomsByUnit.computeIfAbsent(unitId, k -> new ArrayList<>()).add(mapped);
        }

        List<Map<String, Object>> payloadUnits = new ArrayList<>();
        for (Map<String, Object> u : units) {
            String unitId = stringVal(u.get("id"));
            String floorId = stringVal(u.get("floor_id"));
            String blockId = floorToBlock.get(floorId);
            String buildingId = blockToBuilding.get(blockId);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", unitId);
            item.put("uid", unitId);
            item.put("unitCode", u.get("unit_code"));
            item.put("num", u.get("number"));
            item.put("number", u.get("number"));
            item.put("type", u.get("unit_type"));
            item.put("hasMezzanine", Boolean.TRUE.equals(u.get("has_mezzanine")));
            item.put("mezzanineType", u.get("mezzanine_type"));
            item.put("area", u.get("total_area"));
            item.put("livingArea", u.get("living_area"));
            item.put("usefulArea", u.get("useful_area"));
            item.put("rooms", u.get("rooms_count"));
            item.put("floorId", floorId);
            item.put("entranceId", u.get("entrance_id"));
            item.put("buildingId", buildingId);
            item.put("buildingCode", buildingCodeById.get(buildingId));
            item.put("addressId", u.get("address_id"));
            String unitAddressId = stringVal(u.get("address_id"));
            String inheritedBlockAddress = blockId == null ? null : blockAddressById.get(blockId);
            String inheritedBuildingAddress = buildingId == null ? null : buildingAddressById.get(buildingId);
            item.put("effectiveAddressId", unitAddressId != null ? unitAddressId : (inheritedBlockAddress != null ? inheritedBlockAddress : (inheritedBuildingAddress != null ? inheritedBuildingAddress : projectAddressId)));
            item.put("cadastreNumber", u.get("cadastre_number"));
            item.put("explication", roomsByUnit.getOrDefault(unitId, List.of()));
            payloadUnits.add(item);
        }

        return Map.of(
            "buildings", payloadBuildings,
            "blocks", payloadBlocks,
            "floors", payloadFloors,
            "entrances", payloadEntrances,
            "units", payloadUnits
        );
    }

    @Transactional(readOnly = true)
    public Map<String, Object> tepSummary(String projectId) {
        List<Map<String, Object>> buildings = queryList("select id, date_start, date_end from buildings where project_id = :projectId", Map.of("projectId", projectId));

        Map<String, Object> living = bucket();
        Map<String, Object> commercial = bucket();
        Map<String, Object> infrastructure = bucket();
        Map<String, Object> parking = bucket();
        Map<String, Object> mop = new LinkedHashMap<>();
        mop.put("area", 0d);

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalAreaProj", 0d);
        summary.put("totalAreaFact", 0d);
        summary.put("living", living);
        summary.put("commercial", commercial);
        summary.put("infrastructure", infrastructure);
        summary.put("parking", parking);
        summary.put("mop", mop);
        summary.put("cadastreReadyCount", 0);
        summary.put("totalObjectsCount", 0);
        summary.put("avgProgress", 0d);

        if (buildings.isEmpty()) return summary;

        List<String> buildingIds = buildings.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> blocks = queryList("select id from building_blocks where building_id in (:buildingIds)", Map.of("buildingIds", buildingIds));
        List<String> blockIds = blocks.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        if (blockIds.isEmpty()) return summary;

        List<Map<String, Object>> floors = queryList("select id, area_proj, area_fact from floors where block_id in (:blockIds)", Map.of("blockIds", blockIds));
        List<String> floorIds = floors.stream().map(r -> stringVal(r.get("id"))).filter(Objects::nonNull).toList();
        List<Map<String, Object>> units = floorIds.isEmpty() ? List.of() : queryList("select id, unit_type, total_area, cadastre_number from units where floor_id in (:floorIds)", Map.of("floorIds", floorIds));

        double totalAreaProj = 0d;
        double totalAreaFact = 0d;
        for (Map<String, Object> floor : floors) {
            totalAreaProj += toDouble(floor.get("area_proj"));
            totalAreaFact += toDouble(floor.get("area_fact"));
        }
        summary.put("totalAreaProj", totalAreaProj);
        summary.put("totalAreaFact", totalAreaFact);

        double progressSum = 0d;
        for (Map<String, Object> b : buildings) {
            progressSum += progressPercent(b.get("date_start"), b.get("date_end"));
        }
        summary.put("avgProgress", buildings.isEmpty() ? 0d : progressSum / buildings.size());

        int cadastreReady = 0;
        int totalObjects = 0;
        for (Map<String, Object> unit : units) {
            totalObjects += 1;
            if (unit.get("cadastre_number") != null && !String.valueOf(unit.get("cadastre_number")).isBlank()) cadastreReady += 1;
            double area = toDouble(unit.get("total_area"));
            String type = stringVal(unit.get("unit_type"));
            if (Set.of("flat", "duplex_up", "duplex_down").contains(type)) incBucket(living, area);
            else if (Set.of("office", "office_inventory", "non_res_block").contains(type)) incBucket(commercial, area);
            else if ("infrastructure".equals(type)) incBucket(infrastructure, area);
            else if ("parking_place".equals(type)) incBucket(parking, area);
        }
        summary.put("cadastreReadyCount", cadastreReady);
        summary.put("totalObjectsCount", totalObjects);

        double useful = toDouble(living.get("area")) + toDouble(commercial.get("area")) + toDouble(infrastructure.get("area")) + toDouble(parking.get("area"));
        mop.put("area", Math.max(0d, totalAreaProj - useful));

        return summary;
    }

    private List<Map<String, Object>> queryList(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql, Tuple.class);
        params.forEach(query::setParameter);
        @SuppressWarnings("unchecked")
        List<Tuple> tuples = query.getResultList();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Tuple tuple : tuples) {
            rows.add(tupleToMap(tuple));
        }
        return rows;
    }

    private Map<String, Object> queryOne(String sql, Map<String, Object> params) {
        List<Map<String, Object>> rows = queryList(sql, params);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private int execute(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query.executeUpdate();
    }

    private Map<String, Object> tupleToMap(Tuple tuple) {
        Map<String, Object> row = new LinkedHashMap<>();
        tuple.getElements().forEach(e -> row.put(e.getAlias(), tuple.get(e)));
        return row;
    }

    private int toInt(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private String stringVal(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String stringValOr(Object value, String fallback) {
        String val = stringVal(value);
        return val == null || val.isBlank() ? fallback : val;
    }



    private String deriveBlockAddressId(String parentAddressId, String corpusNo) {
        if (parentAddressId == null || corpusNo == null || corpusNo.isBlank()) return null;
        Map<String, Object> parent = queryOne("select district, street, mahalla, city, building_no from addresses where id = :id", Map.of("id", parentAddressId));
        if (parent == null) return null;
        String id = UUID.randomUUID().toString();
        execute("""
            insert into addresses(id, dtype, versionrev, district, street, mahalla, city, building_no, full_address)
            values (:id, 'Address', 0, cast(:district as text), cast(:street as uuid), cast(:mahalla as uuid), :city, :buildingNo, :fullAddress)
            """, Map.of(
            "id", id,
            "district", stringVal(parent.get("district")),
            "street", stringVal(parent.get("street")),
            "mahalla", stringVal(parent.get("mahalla")),
            "city", stringVal(parent.get("city")),
            "buildingNo", corpusNo,
            "fullAddress", ((parent.get("city") == null ? "" : String.valueOf(parent.get("city")) + ", ") + "корп. " + corpusNo)
        ));
        return id;
    }

    private Map<String, Object> bucket() {
        Map<String, Object> b = new LinkedHashMap<>();
        b.put("area", 0d);
        b.put("count", 0);
        return b;
    }

    private void incBucket(Map<String, Object> bucket, double area) {
        bucket.put("area", toDouble(bucket.get("area")) + area);
        bucket.put("count", toInt(bucket.get("count")) + 1);
    }

    private double toDouble(Object value) {
        if (value == null) return 0d;
        if (value instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0d;
        }
    }

    private double progressPercent(Object dateStart, Object dateEnd) {
        try {
            if (dateStart == null || dateEnd == null) return 0d;
            java.time.Instant start = java.time.Instant.parse(String.valueOf(dateStart));
            java.time.Instant end = java.time.Instant.parse(String.valueOf(dateEnd));
            long startMs = start.toEpochMilli();
            long endMs = end.toEpochMilli();
            long nowMs = java.time.Instant.now().toEpochMilli();
            if (endMs <= startMs || nowMs <= startMs) return 0d;
            if (nowMs >= endMs) return 100d;
            return ((double) (nowMs - startMs) / (double) (endMs - startMs)) * 100d;
        } catch (Exception ignored) {
            return 0d;
        }
    }

    private Integer nullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        String str = String.valueOf(value);
        if (str.isBlank()) return null;
        try { return Integer.parseInt(str); } catch (NumberFormatException e) { return null; }
    }

    private List<Map<String, Object>> toMapList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?>) {
                @SuppressWarnings("unchecked")
                Map<String, Object> m = (Map<String, Object>) item;
                out.add(m);
            }
        }
        return out;
    }

    private String toPgUuidArrayLiteral(List<String> uuids) {
        if (uuids == null || uuids.isEmpty()) return "{}";
        return "{" + String.join(",", uuids) + "}";
    }

    private Set<String> toMarkerSet(Object value, boolean technical) {
        if (!(value instanceof List<?> list)) return Set.of();
        Set<String> result = new LinkedHashSet<>();
        for (Object raw : list) {
            if (raw == null) continue;
            if (technical) {
                String str = String.valueOf(raw);
                if (str.contains("-Т")) result.add(str);
                else {
                    Integer parsed = nullableInt(raw);
                    if (parsed != null) result.add(parsed + "-Т");
                }
            } else {
                result.add(String.valueOf(raw));
            }
        }
        return result;
    }

    private int normalizeDepth(int depth) {
        if (depth < 1) return 1;
        return Math.min(depth, 10);
    }

    private List<?> toList(Object value) {
        if (value instanceof List<?> list) return list;
        if (value instanceof Object[] arr) return Arrays.asList(arr);
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> objectToMap(Object value) {
        if (value == null) return Map.of();
        if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
        try {
            return objectMapper.readValue(String.valueOf(value), Map.class);
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapFrom(Object value) {
        if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
        return Map.of();
    }

    private String toJson(Object value) {
        try {
            if (value instanceof String s) return s;
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Failed to serialize JSON payload", e);
        }
    }
}
