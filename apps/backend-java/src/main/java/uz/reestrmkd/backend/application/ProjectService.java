package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class ProjectService {
    private final JdbcTemplate jdbc;

    public ProjectService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Map<String, Object> projects(String scope) {
        var projects = jdbc.queryForList("select * from projects where (? is null or scope_id = ?) order by updated_at desc", scope, scope);
        return Map.of("items", projects, "total", projects.size());
    }

    public Map<String, Object> projectsMapOverview(String scope) {
        if (scope == null || scope.isBlank()) throw new IllegalArgumentException("Scope is required");

        var projectRows = jdbc.queryForList(
            "select id, uj_code, name, address, construction_status, land_plot_geojson from projects where scope_id = ? order by updated_at desc",
            scope
        );

        if (projectRows.isEmpty()) {
            return Map.of("items", List.of());
        }

        var applicationRows = jdbc.queryForList(
            "select project_id, status from applications where scope_id = ?",
            scope
        );

        List<Object> projectIds = projectRows.stream().map(r -> r.get("id")).filter(Objects::nonNull).toList();
        String projectPlaceholders = String.join(",", Collections.nCopies(projectIds.size(), "?"));
        var buildingRows = jdbc.queryForList(
            "select id, project_id, label, house_number, category, building_code, footprint_geojson from buildings where project_id in (" + projectPlaceholders + ")",
            projectIds.toArray()
        );

        List<Object> buildingIds = buildingRows.stream().map(r -> r.get("id")).filter(Objects::nonNull).toList();
        Map<String, List<Map<String, Object>>> blocksByBuilding = new LinkedHashMap<>();
        Map<String, List<Map<String, Object>>> floorsByBlock = new LinkedHashMap<>();
        Map<String, List<Map<String, Object>>> unitsByFloor = new LinkedHashMap<>();

        if (!buildingIds.isEmpty()) {
            String buildingPlaceholders = String.join(",", Collections.nCopies(buildingIds.size(), "?"));
            var blockRows = jdbc.queryForList(
                "select id, building_id, label, floors_count, footprint_geojson, is_basement_block from building_blocks where building_id in (" + buildingPlaceholders + ")",
                buildingIds.toArray()
            );

            for (Map<String, Object> block : blockRows) {
                String buildingId = String.valueOf(block.get("building_id"));
                blocksByBuilding.computeIfAbsent(buildingId, k -> new ArrayList<>()).add(block);
            }

            List<Object> blockIds = blockRows.stream().map(r -> r.get("id")).filter(Objects::nonNull).toList();
            if (!blockIds.isEmpty()) {
                String blockPlaceholders = String.join(",", Collections.nCopies(blockIds.size(), "?"));
                var floorRows = jdbc.queryForList(
                    "select id, block_id from floors where block_id in (" + blockPlaceholders + ")",
                    blockIds.toArray()
                );

                for (Map<String, Object> floor : floorRows) {
                    String blockId = String.valueOf(floor.get("block_id"));
                    floorsByBlock.computeIfAbsent(blockId, k -> new ArrayList<>()).add(floor);
                }

                List<Object> floorIds = floorRows.stream().map(r -> r.get("id")).filter(Objects::nonNull).toList();
                if (!floorIds.isEmpty()) {
                    String floorPlaceholders = String.join(",", Collections.nCopies(floorIds.size(), "?"));
                    var unitRows = jdbc.queryForList(
                        "select id, floor_id, unit_type from units where floor_id in (" + floorPlaceholders + ")",
                        floorIds.toArray()
                    );

                    for (Map<String, Object> unit : unitRows) {
                        String floorId = String.valueOf(unit.get("floor_id"));
                        unitsByFloor.computeIfAbsent(floorId, k -> new ArrayList<>()).add(unit);
                    }
                }
            }
        }

        Map<String, String> statusByProject = new LinkedHashMap<>();
        for (Map<String, Object> app : applicationRows) {
            String projectId = String.valueOf(app.get("project_id"));
            if (!statusByProject.containsKey(projectId)) {
                statusByProject.put(projectId, app.get("status") == null ? null : String.valueOf(app.get("status")));
            }
        }

        Map<String, List<Map<String, Object>>> buildingsByProject = new LinkedHashMap<>();
        for (Map<String, Object> row : buildingRows) {
            String projectId = String.valueOf(row.get("project_id"));
            String buildingId = String.valueOf(row.get("id"));

            List<Map<String, Object>> blocks = blocksByBuilding.getOrDefault(buildingId, List.of());
            List<Map<String, Object>> regularBlocks = blocks.stream()
                .filter(block -> !Boolean.TRUE.equals(block.get("is_basement_block")))
                .toList();
            int floorsMax = 0;
            List<Map<String, Object>> floors = new ArrayList<>();
            for (Map<String, Object> block : regularBlocks) {
                floorsMax = Math.max(floorsMax, toInt(block.get("floors_count")));
                String blockId = String.valueOf(block.get("id"));
                floors.addAll(floorsByBlock.getOrDefault(blockId, List.of()));
            }

            List<Map<String, Object>> units = new ArrayList<>();
            for (Map<String, Object> floor : floors) {
                units.addAll(unitsByFloor.getOrDefault(String.valueOf(floor.get("id")), List.of()));
            }

            int apartmentsCount = (int) units.stream()
                .filter(unit -> "apartment".equals(String.valueOf(unit.get("unit_type"))))
                .count();

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.get("id"));
            item.put("label", row.get("label"));
            item.put("buildingCode", row.get("building_code"));
            item.put("houseNumber", row.get("house_number"));
            item.put("house_number", row.get("house_number"));
            item.put("category", row.get("category"));
            item.put("blocksCount", regularBlocks.size());
            item.put("floorsMax", floorsMax > 0 ? floorsMax : null);
            item.put("unitsCount", units.size());
            item.put("apartmentsCount", apartmentsCount);
            item.put("address", row.get("house_number") == null ? null : "д. " + row.get("house_number"));
            item.put("geometry", row.get("footprint_geojson"));
            item.put("blocks", regularBlocks.stream().map(block -> {
                Map<String, Object> blockPayload = new LinkedHashMap<>();
                blockPayload.put("id", block.get("id"));
                blockPayload.put("label", block.get("label"));
                blockPayload.put("floorsCount", toInt(block.get("floors_count")));
                blockPayload.put("geometry", block.get("footprint_geojson"));
                return blockPayload;
            }).toList());


            buildingsByProject.computeIfAbsent(projectId, k -> new ArrayList<>()).add(item);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> row : projectRows) {
            String projectId = String.valueOf(row.get("id"));
            List<Map<String, Object>> projectBuildings = buildingsByProject.getOrDefault(projectId, List.of());
            Map<String, Integer> categoryStats = new LinkedHashMap<>();
            for (Map<String, Object> building : projectBuildings) {
                String category = building.get("category") == null ? "unknown" : String.valueOf(building.get("category"));
                categoryStats.put(category, categoryStats.getOrDefault(category, 0) + 1);
            }

            List<Map<String, Object>> buildingTypeStats = new ArrayList<>();
            for (Map.Entry<String, Integer> entry : categoryStats.entrySet()) {
                buildingTypeStats.add(Map.of("category", entry.getKey(), "count", entry.getValue()));
            }

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", row.get("id"));
            item.put("ujCode", row.get("uj_code"));
            item.put("name", row.get("name"));
            item.put("address", row.get("address"));
            item.put("status", statusByProject.getOrDefault(projectId, row.get("construction_status") == null ? null : String.valueOf(row.get("construction_status"))));
            item.put("totalBuildings", projectBuildings.size());
            item.put("buildingTypeStats", buildingTypeStats);
            item.put("landPlotGeometry", row.get("land_plot_geojson"));
            item.put("buildings", projectBuildings);
            items.add(item);
        }

        return Map.of("items", items);
    }

    public List<Map<String, Object>> externalApplications(String scope) {
        return List.of(Map.of(
            "id", "EXT-10001",
            "source", "EPIGU",
            "externalId", "EP-2026-9912",
            "status", "NEW",
            "scope", scope
        ));
    }

    public Map<String, Object> summaryCounts(String scope) {
        Integer total = jdbc.queryForObject("select count(1) from applications where (? is null or scope_id = ?)", Integer.class, scope, scope);
        return Map.of("total", total == null ? 0 : total);
    }

    public Map<String, Object> applicationId(String projectId, String scope) {
        var rows = jdbc.queryForList("select id from applications where project_id=? and (? is null or scope_id=?) limit 1", projectId, scope, scope);
        return Map.of("applicationId", rows.isEmpty() ? null : rows.get(0).get("id"));
    }

    public Map<String, Object> validateStep(String projectId, String scope, String stepId) {
        return Map.of("ok", true, "stepId", stepId, "errors", List.of());
    }

    @Transactional
    public Map<String, Object> fromApplication(Map<String, Object> body) {
        String projectId = body.get("projectId") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("projectId"));
        jdbc.update("insert into projects(id, name, scope_id, updated_at) values (?, ?, ?, now()) on conflict (id) do update set updated_at=now()",
            projectId, body.getOrDefault("name", "Без названия"), body.get("scope"));
        return Map.of("ok", true, "projectId", projectId);
    }

    public Map<String, Object> context(String projectId, String scope) { return Map.of("projectId", projectId, "scope", scope); }

    @Transactional
    public Map<String, Object> contextBuildingSave(String projectId, Map<String, Object> body) {
        Object raw = body == null ? null : body.get("buildingDetails");
        if (!(raw instanceof Map<?, ?> details)) return Map.of("ok", true);

        for (Map.Entry<?, ?> e : details.entrySet()) {
            String key = e.getKey() == null ? null : String.valueOf(e.getKey());
            if (key == null || key.contains("_features") || key.endsWith("_data")) continue;
            String[] parts = key.split("_");
            String blockId = parts.length == 0 ? null : parts[parts.length - 1];
            if (blockId == null || blockId.length() != 36) continue;
            if (!(e.getValue() instanceof Map<?, ?> block)) continue;

            Object geometry = block.get("blockGeometry");
            if (geometry == null) {
                throw new IllegalArgumentException("Block geometry is required");
            }
            String geometryJson = toJson(geometry);

            jdbc.update("update building_blocks set footprint_geojson = cast(? as jsonb), updated_at=now() where id=?", geometryJson, blockId);
        }

        return Map.of("ok", true);
    }
    @Transactional public Map<String, Object> contextMetaSave(String projectId, Map<String, Object> body) { return Map.of("ok", true); }
    @Transactional
    public Map<String, Object> stepBlockStatusesSave(String projectId, Map<String, Object> body) {
        String scope = body == null || body.get("scope") == null ? "" : String.valueOf(body.get("scope")).trim();
        int stepIndex = body == null ? -1 : toInt(body.get("stepIndex"));
        if (scope.isBlank()) throw new IllegalArgumentException("scope is required");
        if (stepIndex < 0) throw new IllegalArgumentException("stepIndex must be a non-negative number");

        var appRows = jdbc.queryForList("select id from applications where project_id=? and scope_id=? limit 1", projectId, scope);
        if (appRows.isEmpty()) throw new NoSuchElementException("Application not found");
        String applicationId = String.valueOf(appRows.get(0).get("id"));

        String statusesJson = toJson(body == null ? null : body.get("statuses"));
        jdbc.update("""
            insert into application_steps(application_id, step_index, block_statuses, updated_at)
            values (?, ?, cast(? as jsonb), now())
            on conflict (application_id, step_index) do update
            set block_statuses=excluded.block_statuses, updated_at=now()
            """, applicationId, stepIndex, statusesJson);

        return Map.of("applicationId", applicationId, "stepIndex", stepIndex, "blockStatuses", body == null ? Map.of() : body.getOrDefault("statuses", Map.of()));
    }

    public Map<String, Object> contextRegistryDetails(String projectId) { return Map.of("projectId", projectId); }
    public Map<String, Object> passport(String projectId) { return Map.of("projectId", projectId); }
    @Transactional public Map<String, Object> updatePassport(String projectId, Map<String, Object> body) { return Map.of("ok", true); }
    @Transactional public Map<String, Object> participants(String projectId, String role, Map<String, Object> body) { return Map.of("ok", true); }

    @Transactional
    public Map<String, Object> documents(String projectId, Map<String, Object> body) {
        String id = body.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("id"));
        jdbc.update("insert into project_documents(id, project_id, file_name, url, updated_at) values (?, ?, ?, ?, now())",
            id, projectId, body.get("fileName"), body.get("url"));
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> deleteDoc(String documentId) {
        jdbc.update("delete from project_documents where id=?", documentId);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> deleteProject(String projectId) {
        jdbc.update("delete from projects where id=?", projectId);
        return Map.of("ok", true);
    }

    public Map<String, Object> integrationStatus(String projectId) {
        var rows = jdbc.queryForList("select integration_status from projects where id=?", projectId);
        return Map.of("integrationStatus", rows.isEmpty() ? null : rows.get(0).get("integration_status"));
    }

    @Transactional
    public Map<String, Object> updateIntegrationStatus(String projectId, Map<String, Object> body) {
        jdbc.update("update projects set integration_status=?, updated_at=now() where id=?", body.get("integrationStatus"), projectId);
        return Map.of("ok", true);
    }

    public Map<String, Object> parkingCounts(String projectId) {
        Integer count = jdbc.queryForObject("select count(1) from units u join floors f on f.id=u.floor_id join building_blocks b on b.id=f.block_id join buildings g on g.id=b.building_id where g.project_id=? and u.unit_type='parking'", Integer.class, projectId);
        return Map.of("parkingPlaces", count == null ? 0 : count);
    }

    public List<Map<String, Object>> buildingsSummary() {
        return jdbc.queryForList("select id, project_id, building_code, label, category from buildings order by created_at desc");
    }

    public List<Map<String, Object>> basements(String projectId) {
        return jdbc.queryForList("select * from basements where project_id=? order by level asc", projectId);
    }

    @Transactional
    public Map<String, Object> updateBasementLevel(String basementId, Integer level, Map<String, Object> body) {
        jdbc.update("update basements set parking_places=?, updated_at=now() where id=? and level=?",
            body.get("parkingPlaces"), basementId, level);
        return Map.of("ok", true);
    }

    private int toInt(Object value) {
        if (value == null) return -1;
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (Exception e) { return -1; }
    }

    private String toJson(Object value) {
        if (value == null) return "{}";
        if (value instanceof Map || value instanceof List) {
            try {
                return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value);
            } catch (Exception e) {
                throw new IllegalArgumentException("statuses must be valid json");
            }
        }
        return String.valueOf(value);
    }

    public Map<String, Object> fullRegistry(String projectId) {
        List<Map<String, Object>> buildings = jdbc.queryForList("select * from buildings where project_id=?", projectId);
        if (buildings.isEmpty()) {
            return Map.of("buildings", List.of(), "units", List.of());
        }

        List<Object> buildingIds = buildings.stream().map(b -> b.get("id")).filter(Objects::nonNull).toList();
        String buildingPlaceholders = String.join(",", Collections.nCopies(buildingIds.size(), "?"));

        List<Map<String, Object>> blocks = jdbc.queryForList(
            "select * from building_blocks where building_id in (" + buildingPlaceholders + ")",
            buildingIds.toArray()
        );

        List<Object> blockIds = blocks.stream().map(b -> b.get("id")).filter(Objects::nonNull).toList();
        List<Map<String, Object>> extensions = blockIds.isEmpty()
            ? List.of()
            : jdbc.queryForList(
                "select * from block_extensions where parent_block_id in (" + String.join(",", Collections.nCopies(blockIds.size(), "?")) + ") order by created_at asc",
                blockIds.toArray()
            );

        Map<String, List<Map<String, Object>>> extensionsByBlockId = new HashMap<>();
        for (Map<String, Object> ext : extensions) {
            Object parentBlockId = ext.get("parent_block_id");
            if (parentBlockId == null) continue;
            extensionsByBlockId.computeIfAbsent(String.valueOf(parentBlockId), k -> new ArrayList<>()).add(ext);
        }

        List<Map<String, Object>> floors = blockIds.isEmpty()
            ? List.of()
            : jdbc.queryForList(
                "select * from floors where block_id in (" + String.join(",", Collections.nCopies(blockIds.size(), "?")) + ")",
                blockIds.toArray()
            );

        List<Object> floorIds = floors.stream().map(f -> f.get("id")).filter(Objects::nonNull).toList();

        List<Map<String, Object>> entrances = blockIds.isEmpty()
            ? List.of()
            : jdbc.queryForList(
                "select id, block_id, number from entrances where block_id in (" + String.join(",", Collections.nCopies(blockIds.size(), "?")) + ")",
                blockIds.toArray()
            );

        List<Map<String, Object>> units = floorIds.isEmpty()
            ? List.of()
            : jdbc.queryForList(
                "select * from units where floor_id in (" + String.join(",", Collections.nCopies(floorIds.size(), "?")) + ") order by id asc",
                floorIds.toArray()
            );

        List<Object> unitIds = units.stream().map(u -> u.get("id")).filter(Objects::nonNull).toList();

        List<Map<String, Object>> rooms = unitIds.isEmpty()
            ? List.of()
            : jdbc.queryForList(
                "select * from rooms where unit_id in (" + String.join(",", Collections.nCopies(unitIds.size(), "?")) + ")",
                unitIds.toArray()
            );

        Map<String, String> floorToBlockMap = new HashMap<>();
        for (Map<String, Object> floor : floors) {
            if (floor.get("id") != null && floor.get("block_id") != null) {
                floorToBlockMap.put(String.valueOf(floor.get("id")), String.valueOf(floor.get("block_id")));
            }
        }

        Map<String, String> blockToBuildingMap = new HashMap<>();
        for (Map<String, Object> block : blocks) {
            if (block.get("id") != null && block.get("building_id") != null) {
                blockToBuildingMap.put(String.valueOf(block.get("id")), String.valueOf(block.get("building_id")));
            }
        }

        Map<String, Object> buildingCodeMap = new HashMap<>();
        for (Map<String, Object> building : buildings) {
            if (building.get("id") != null) {
                buildingCodeMap.put(String.valueOf(building.get("id")), building.get("building_code"));
            }
        }

        List<Map<String, Object>> payloadBuildings = new ArrayList<>();
        for (Map<String, Object> building : buildings) {
            Map<String, Object> item = new LinkedHashMap<>(building);
            item.put("label", building.get("label"));
            item.put("houseNumber", building.get("house_number"));
            item.put("buildingCode", building.get("building_code"));
            payloadBuildings.add(item);
        }

        List<Map<String, Object>> payloadBlocks = new ArrayList<>();
        for (Map<String, Object> block : blocks) {
            Map<String, Object> item = new LinkedHashMap<>(block);
            item.put("tabLabel", block.get("label"));
            item.put("buildingId", block.get("building_id"));
            item.put("isBasementBlock", Boolean.TRUE.equals(block.get("is_basement_block")));
            item.put("linkedBlockIds", block.get("linked_block_ids"));
            item.put("extensions", extensionsByBlockId.getOrDefault(String.valueOf(block.get("id")), List.of()).stream().map(ext -> {
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
        for (Map<String, Object> entrance : entrances) {
            payloadEntrances.add(Map.of(
                "id", entrance.get("id"),
                "blockId", entrance.get("block_id"),
                "number", entrance.get("number")
            ));
        }

        Map<String, List<Map<String, Object>>> roomsByUnit = new HashMap<>();
        for (Map<String, Object> room : rooms) {
            Object unitId = room.get("unit_id");
            if (unitId == null) continue;
            Map<String, Object> mapped = new LinkedHashMap<>();
            mapped.put("id", room.get("id"));
            mapped.put("type", room.get("room_type"));
            mapped.put("label", room.get("name"));
            mapped.put("area", room.get("area"));
            mapped.put("height", room.get("room_height"));
            mapped.put("level", room.get("level"));
            mapped.put("isMezzanine", Boolean.TRUE.equals(room.get("is_mezzanine")));
            roomsByUnit.computeIfAbsent(String.valueOf(unitId), k -> new ArrayList<>()).add(mapped);
        }

        List<Map<String, Object>> payloadUnits = new ArrayList<>();
        for (Map<String, Object> unit : units) {
            String unitId = unit.get("id") == null ? null : String.valueOf(unit.get("id"));
            String floorId = unit.get("floor_id") == null ? null : String.valueOf(unit.get("floor_id"));
            String blockId = floorToBlockMap.get(floorId);
            String buildingId = blockToBuildingMap.get(blockId);

            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", unitId);
            item.put("uid", unitId);
            item.put("unitCode", unit.get("unit_code"));
            item.put("num", unit.get("number"));
            item.put("number", unit.get("number"));
            item.put("type", unit.get("unit_type"));
            item.put("hasMezzanine", Boolean.TRUE.equals(unit.get("has_mezzanine")));
            item.put("mezzanineType", unit.get("mezzanine_type"));
            item.put("area", unit.get("total_area"));
            item.put("livingArea", unit.get("living_area"));
            item.put("usefulArea", unit.get("useful_area"));
            item.put("rooms", unit.get("rooms_count"));
            item.put("floorId", floorId);
            item.put("entranceId", unit.get("entrance_id"));
            item.put("buildingId", buildingId);
            item.put("buildingCode", buildingCodeMap.get(buildingId));
            item.put("cadastreNumber", unit.get("cadastre_number"));
            item.put("explication", unitId == null ? List.of() : roomsByUnit.getOrDefault(unitId, List.of()));
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

    public Map<String, Object> tepSummary(String projectId) {
        Double area = jdbc.queryForObject("select coalesce(sum(total_area),0) from units u join floors f on f.id=u.floor_id join building_blocks b on b.id=f.block_id join buildings g on g.id=b.building_id where g.project_id=?", Double.class, projectId);
        return Map.of("projectId", projectId, "totalArea", area == null ? 0d : area);
    }
}
