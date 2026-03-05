package uz.reestrmkd.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.MapResponseDto;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.service.SecurityPolicyService;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
public class CompositionController {
    private static final Map<String, Boolean> DEFAULT_BASEMENT_COMMUNICATIONS = Map.of(
        "electricity", false,
        "water", false,
        "sewerage", false,
        "heating", false,
        "ventilation", false,
        "gas", false,
        "firefighting", false
    );

    private final JdbcTemplate jdbcTemplate;
    private final SecurityPolicyService securityPolicyService;
    private final ObjectMapper objectMapper;

    public CompositionController(JdbcTemplate jdbcTemplate, SecurityPolicyService securityPolicyService, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.securityPolicyService = securityPolicyService;
        this.objectMapper = objectMapper;
    }

    @GetMapping("/projects/{projectId}/buildings")
    public List<Map<String, Object>> getBuildings(@PathVariable UUID projectId) {
        List<Map<String, Object>> buildings = jdbcTemplate.queryForList(
            "select * from buildings where project_id = ? order by created_at asc",
            projectId
        );
        if (buildings.isEmpty()) return List.of();

        List<UUID> buildingIds = buildings.stream().map(row -> (UUID) row.get("id")).toList();
        String bIn = String.join(",", Collections.nCopies(buildingIds.size(), "?"));
        List<Map<String, Object>> blocks = jdbcTemplate.queryForList(
            "select * from building_blocks where building_id in (" + bIn + ")",
            buildingIds.toArray()
        );

        Map<UUID, List<Map<String, Object>>> blocksByBuilding = blocks.stream()
            .collect(Collectors.groupingBy(row -> (UUID) row.get("building_id"), LinkedHashMap::new, Collectors.toList()));

        List<UUID> blockIds = blocks.stream().map(row -> (UUID) row.get("id")).toList();
        Map<UUID, List<Map<String, Object>>> extByBlock = new LinkedHashMap<>();
        if (!blockIds.isEmpty()) {
            String in = String.join(",", Collections.nCopies(blockIds.size(), "?"));
            List<Map<String, Object>> exts = jdbcTemplate.queryForList(
                "select * from block_extensions where parent_block_id in (" + in + ")",
                blockIds.toArray()
            );
            extByBlock = exts.stream().collect(Collectors.groupingBy(r -> (UUID) r.get("parent_block_id"), LinkedHashMap::new, Collectors.toList()));
        }

        final Map<UUID, List<Map<String, Object>>> extByBlockFinal = extByBlock;

        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> b : buildings) {
            List<Map<String, Object>> allBlocks = blocksByBuilding.getOrDefault((UUID) b.get("id"), List.of());
            List<Map<String, Object>> activeBlocks = allBlocks.stream().filter(bl -> !Boolean.TRUE.equals(bl.get("is_basement_block"))).toList();
            List<Map<String, Object>> basementBlocks = allBlocks.stream().filter(bl -> Boolean.TRUE.equals(bl.get("is_basement_block"))).toList();

            int resBlocks = (int) activeBlocks.stream().filter(bl -> "Ж".equals(bl.get("type"))).count();
            int nonResBlocks = (int) activeBlocks.stream().filter(bl -> "Н".equals(bl.get("type"))).count();

            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", b.get("id"));
            dto.put("buildingCode", b.get("building_code"));
            dto.put("label", b.get("label"));
            dto.put("houseNumber", b.get("house_number"));
            dto.put("addressId", b.get("address_id"));
            dto.put("effectiveAddressId", b.get("address_id"));
            dto.put("category", b.get("category"));
            dto.put("type", b.get("category"));
            dto.put("stage", b.get("stage") == null ? "Проектный" : b.get("stage"));
            dto.put("resBlocks", resBlocks);
            dto.put("nonResBlocks", nonResBlocks);
            dto.put("parkingType", normalizeParkingTypeFromDb(s(b.get("parking_type"))));
            dto.put("constructionType", normalizeParkingConstructionFromDb(s(b.get("construction_type"))));
            dto.put("infraType", b.get("infra_type"));
            dto.put("hasNonResPart", b.get("has_non_res_part") != null ? b.get("has_non_res_part") : nonResBlocks > 0);
            dto.put("cadastreNumber", b.get("cadastre_number"));
            dto.put("cadastre_number", b.get("cadastre_number"));
            dto.put("geometry", parseJsonb(b.get("footprint_geojson")));
            dto.put("footprintGeojson", parseJsonb(b.get("footprint_geojson")));
            dto.put("buildingFootprintAreaM2", b.get("building_footprint_area_m2"));
            dto.put("dateStart", b.get("date_start"));
            dto.put("dateEnd", b.get("date_end"));
            dto.put("geometryCandidateId", b.get("geometry_candidate_id"));
            dto.put("basementsCount", basementBlocks.size());

            List<Map<String, Object>> mappedBlocks = allBlocks.stream().map(bl -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("id", bl.get("id"));
                m.put("label", bl.get("label"));
                m.put("type", mapBlockTypeToUi(s(bl.get("type"))));
                m.put("originalType", bl.get("type"));
                m.put("floorsCount", bl.get("floors_count"));
                m.put("isBasementBlock", Boolean.TRUE.equals(bl.get("is_basement_block")));
                m.put("linkedBlockIds", parseSqlArray(bl.get("linked_block_ids")));
                List<Map<String, Object>> ext = extByBlockFinal.getOrDefault((UUID) bl.get("id"), List.of()).stream().map(e -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("id", e.get("id"));
                    item.put("label", e.get("label"));
                    item.put("extensionType", e.get("extension_type"));
                    item.put("floorsCount", e.get("floors_count"));
                    item.put("startFloorIndex", e.get("start_floor_index"));
                    return item;
                }).toList();
                m.put("extensions", ext);
                return m;
            }).sorted(Comparator.comparing(x -> String.valueOf(x.get("label")))).toList();

            dto.put("blocks", mappedBlocks);
            result.add(dto);
        }

        return result;
    }

    @PostMapping("/projects/{projectId}/buildings")
    @Transactional
    public MapResponseDto create(@PathVariable UUID projectId, @RequestBody(required = false) Map<String, Object> body) {
        requirePolicy("composition", "mutate", "Role cannot modify composition");

        Map<String, Object> buildingData = asMap(body == null ? null : body.get("buildingData"));
        List<Map<String, Object>> blocksData = asList(body == null ? null : body.get("blocksData"));

        String geometryCandidateId = s(buildingData.get("geometryCandidateId"));
        if (geometryCandidateId == null || geometryCandidateId.isBlank()) {
            throw new ApiException("Geometry candidate is required for building save", "VALIDATION_ERROR", null, 400);
        }

        Map<String, Object> projectRow = jdbcTemplate.queryForList("select uj_code, address_id from projects where id=?", projectId)
            .stream().findFirst().orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));

        String segment = generateNextBuildingCode(projectId, s(buildingData.get("category")), blocksData.size());
        String ujCode = s(projectRow.get("uj_code"));
        String buildingCode = ujCode == null || ujCode.isBlank() ? segment : ujCode + "-" + segment;

        UUID addressId = buildingData.get("addressId") == null || s(buildingData.get("addressId")).isBlank()
            ? inheritBuildingAddressId(projectId, s(buildingData.get("houseNumber")))
            : UUID.fromString(s(buildingData.get("addressId")));

        UUID buildingId = UUID.randomUUID();
        jdbcTemplate.update(
            "insert into buildings(id, project_id, building_code, label, house_number, address_id, category, construction_type, parking_type, infra_type, has_non_res_part, geometry_candidate_id, footprint_geojson, building_footprint_area_m2, created_at, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,now(),now())",
            buildingId,
            projectId,
            buildingCode,
            buildingData.get("label"),
            buildingData.get("houseNumber"),
            addressId,
            buildingData.get("category"),
            sanitizeConstructionType(buildingData),
            sanitizeParkingType(buildingData),
            sanitizeInfraType(buildingData),
            b(buildingData.get("hasNonResPart")),
            null,
            null,
            null
        );

        assignGeometry(projectId, buildingId, UUID.fromString(geometryCandidateId));

        if (!blocksData.isEmpty()) {
            for (Map<String, Object> block : blocksData) {
                UUID blockId = block.get("id") == null ? UUID.randomUUID() : UUID.fromString(s(block.get("id")));
                int floors = n(block.get("floorsCount"), 0);
                jdbcTemplate.update(
                    "insert into building_blocks(id, building_id, label, type, floors_count, floors_from, floors_to, created_at, updated_at) values (?,?,?,?,?,?,?,now(),now())",
                    blockId,
                    buildingId,
                    block.get("label"),
                    mapBlockTypeToDb(s(block.get("type"))),
                    floors,
                    1,
                    floors == 0 ? 1 : floors
                );
            }
        }

        int basementCount = canHaveBasements(buildingData) ? resolveBasementCount(buildingData) : 0;
        if (basementCount > 0) {
            List<UUID> nonBasement = blocksData.stream().map(r -> r.get("id") == null ? null : UUID.fromString(s(r.get("id")))).filter(Objects::nonNull).toList();
            UUID[] linked = nonBasement.size() == 1 ? new UUID[]{nonBasement.getFirst()} : new UUID[]{};
            for (int i = 0; i < basementCount; i++) {
                jdbcTemplate.update(
                    "insert into building_blocks(id, building_id, label, type, is_basement_block, linked_block_ids, basement_depth, basement_has_parking, basement_parking_levels, basement_communications, entrances_count, created_at, updated_at) values (?,?,?,?,?,?,?,false,'{}'::jsonb,?::jsonb,1,now(),now())",
                    UUID.randomUUID(),
                    buildingId,
                    "Подвал " + (i + 1),
                    "BAS",
                    true,
                    linked,
                    1,
                    json(DEFAULT_BASEMENT_COMMUNICATIONS)
                );
            }
        }

        return MapResponseDto.of(Map.of("id", buildingId, "ok", true));
    }

    @PutMapping("/buildings/{buildingId}")
    @Transactional
    public MapResponseDto update(@PathVariable UUID buildingId, @RequestBody(required = false) Map<String, Object> body) {
        requirePolicy("composition", "mutate", "Role cannot modify composition");

        Map<String, Object> buildingData = asMap(body == null ? null : body.get("buildingData"));
        List<Map<String, Object>> blocksData = body != null && body.get("blocksData") != null ? asList(body.get("blocksData")) : null;
        String geometryCandidateId = s(buildingData.get("geometryCandidateId"));
        if (geometryCandidateId == null || geometryCandidateId.isBlank()) {
            throw new ApiException("Geometry candidate is required for building save", "VALIDATION_ERROR", null, 400);
        }

        Map<String, Object> existing = jdbcTemplate.queryForList("select project_id from buildings where id=?", buildingId)
            .stream().findFirst().orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        UUID projectId = (UUID) existing.get("project_id");

        UUID addressId = buildingData.get("addressId") == null || s(buildingData.get("addressId")).isBlank()
            ? inheritBuildingAddressId(projectId, s(buildingData.get("houseNumber")))
            : UUID.fromString(s(buildingData.get("addressId")));

        jdbcTemplate.update(
            "update buildings set label=?, house_number=?, address_id=?, construction_type=?, parking_type=?, infra_type=?, has_non_res_part=?, updated_at=now() where id=?",
            buildingData.get("label"),
            buildingData.get("houseNumber"),
            addressId,
            sanitizeConstructionType(buildingData),
            sanitizeParkingType(buildingData),
            sanitizeInfraType(buildingData),
            b(buildingData.get("hasNonResPart")),
            buildingId
        );

        assignGeometry(projectId, buildingId, UUID.fromString(geometryCandidateId));

        if (blocksData != null) {
            List<Map<String, Object>> existingBlocks = jdbcTemplate.queryForList(
                "select id from building_blocks where building_id=? and coalesce(is_basement_block,false)=false",
                buildingId
            );
            Set<UUID> existingIds = existingBlocks.stream().map(r -> (UUID) r.get("id")).collect(Collectors.toSet());
            Set<UUID> nextIds = blocksData.stream().map(r -> r.get("id") == null ? null : UUID.fromString(s(r.get("id")))).filter(Objects::nonNull).collect(Collectors.toSet());

            for (Map<String, Object> block : blocksData) {
                UUID id = block.get("id") == null ? UUID.randomUUID() : UUID.fromString(s(block.get("id")));
                int floors = n(block.get("floorsCount"), 0);
                if (existingIds.contains(id)) {
                    jdbcTemplate.update(
                        "update building_blocks set label=?, type=?, floors_count=?, floors_from=1, floors_to=?, updated_at=now() where id=?",
                        block.get("label"), mapBlockTypeToDb(s(block.get("type"))), floors, floors == 0 ? 1 : floors, id
                    );
                } else {
                    jdbcTemplate.update(
                        "insert into building_blocks(id, building_id, label, type, floors_count, floors_from, floors_to, created_at, updated_at) values (?,?,?,?,?,?,?,now(),now())",
                        id, buildingId, block.get("label"), mapBlockTypeToDb(s(block.get("type"))), floors, 1, floors == 0 ? 1 : floors
                    );
                }
            }

            List<UUID> deleteIds = existingIds.stream().filter(id -> !nextIds.contains(id)).toList();
            if (!deleteIds.isEmpty()) {
                String in = String.join(",", Collections.nCopies(deleteIds.size(), "?"));
                jdbcTemplate.update("delete from building_blocks where id in (" + in + ")", deleteIds.toArray());
            }
        }

        syncBasements(buildingId, buildingData);
       return MapResponseDto.of(Map.of("id", buildingId, "ok", true));
    }

    @DeleteMapping("/buildings/{buildingId}")
    @Transactional
    public MapResponseDto delete(@PathVariable UUID buildingId) {
        requirePolicy("composition", "mutate", "Role cannot modify composition");
        jdbcTemplate.update("delete from buildings where id = ?", buildingId);
        return MapResponseDto.of(Map.of("ok", true));
    }

    private void syncBasements(UUID buildingId, Map<String, Object> buildingData) {
        Map<String, Object> b = jdbcTemplate.queryForMap("select category, parking_type, construction_type from buildings where id=?", buildingId);
        boolean allowed = canHaveBasements(Map.of(
            "category", b.get("category"),
            "parkingType", normalizeParkingTypeFromDb(s(b.get("parking_type"))),
            "constructionType", normalizeParkingConstructionFromDb(s(b.get("construction_type")))
        ));
        int target = allowed ? resolveBasementCount(buildingData) : 0;

        List<Map<String, Object>> existingBasements = jdbcTemplate.queryForList(
            "select id, linked_block_ids from building_blocks where building_id=? and coalesce(is_basement_block,false)=true order by created_at asc",
            buildingId
        );
        List<UUID> nonBasementIds = jdbcTemplate.queryForList(
            "select id from building_blocks where building_id=? and coalesce(is_basement_block,false)=false",
            UUID.class,
            buildingId
        );

        if (nonBasementIds.size() == 1) {
            UUID[] single = new UUID[]{nonBasementIds.getFirst()};
            for (Map<String, Object> row : existingBasements) {
                Object linked = row.get("linked_block_ids");
                if (linked == null || (linked instanceof UUID[] arr && arr.length == 0)) {
                    jdbcTemplate.update("update building_blocks set linked_block_ids=? where id=?", single, row.get("id"));
                }
            }
        }

        if (existingBasements.size() < target) {
            UUID[] linked = nonBasementIds.size() == 1 ? new UUID[]{nonBasementIds.getFirst()} : new UUID[]{};
            for (int i = 0; i < target - existingBasements.size(); i++) {
                jdbcTemplate.update(
                    "insert into building_blocks(id, building_id, label, type, is_basement_block, linked_block_ids, basement_depth, basement_has_parking, basement_parking_levels, basement_communications, entrances_count, created_at, updated_at) values (?,?,?,?,?,?,?,false,'{}'::jsonb,?::jsonb,1,now(),now())",
                    UUID.randomUUID(), buildingId, "Подвал " + (existingBasements.size() + i + 1), "BAS", true, linked, 1, json(DEFAULT_BASEMENT_COMMUNICATIONS)
                );
            }
        } else if (existingBasements.size() > target) {
            List<UUID> deleteIds = existingBasements.stream().skip(target).map(r -> (UUID) r.get("id")).toList();
            if (!deleteIds.isEmpty()) {
                String in = String.join(",", Collections.nCopies(deleteIds.size(), "?"));
                jdbcTemplate.update("delete from building_blocks where id in (" + in + ")", deleteIds.toArray());
            }
        }
    }

    private UUID inheritBuildingAddressId(UUID projectId, String houseNumber) {
        if (houseNumber == null || houseNumber.isBlank()) return null;
        List<Map<String, Object>> projectRows = jdbcTemplate.queryForList("select address_id from projects where id=?", projectId);
        if (projectRows.isEmpty() || projectRows.getFirst().get("address_id") == null) return null;
        UUID projectAddressId = (UUID) projectRows.getFirst().get("address_id");

        List<Map<String, Object>> parentRows = jdbcTemplate.queryForList("select district, street, mahalla, city from addresses where id=?", projectAddressId);
        if (parentRows.isEmpty()) return null;
        Map<String, Object> parent = parentRows.getFirst();

        UUID id = UUID.randomUUID();
        String city = s(parent.get("city"));
        String fullAddress = (city == null ? "" : city) + (houseNumber == null ? "" : ", д. " + houseNumber);
        
        // ИСПРАВЛЕНО: убрали created_at и updated_at из запроса
        jdbcTemplate.update(
            "insert into addresses(id, dtype, versionrev, district, street, mahalla, city, building_no, full_address) values (?,?,0,?,?,?,?,?,?)",
            id,
            "Address",
            parent.get("district"),
            parent.get("street"),
            parent.get("mahalla"),
            parent.get("city"),
            houseNumber,
            fullAddress
        );
        return id;
    }

    private String generateNextBuildingCode(UUID projectId, String category, int blocksCount) {
        String prefix = getBuildingPrefix(category, blocksCount > 1);
        List<String> rows = jdbcTemplate.queryForList("select building_code from buildings where project_id = ? and building_code is not null", String.class, projectId);

        int max = 0;
        for (String code : rows) {
            String segment = extractBuildingSegment(code);
            if (segment == null || !segment.startsWith(prefix)) continue;
            try {
                int n = Integer.parseInt(segment.substring(prefix.length()));
                max = Math.max(max, n);
            } catch (Exception ignored) {
            }
        }
        return prefix + String.format("%02d", max + 1);
    }

    private String extractBuildingSegment(String code) {
        if (code == null) return null;
        String[] parts = code.split("-");
        return parts.length > 1 ? parts[parts.length - 1] : code;
    }

    private String getBuildingPrefix(String category, boolean hasMultipleBlocks) {
        if ("residential_multiblock".equals(category)) return "ZM";
        if ("residential".equals(category)) return hasMultipleBlocks ? "ZM" : "ZR";
        if ("parking_separate".equals(category) || "parking_integrated".equals(category)) return "ZP";
        if ("infrastructure".equals(category)) return "ZI";
        return "ZR";
    }

    private String mapBlockTypeToUi(String dbType) {
        return switch (dbType) {
            case "Ж" -> "residential";
            case "Н" -> "non_residential";
            case "Parking" -> "parking";
            case "Infra" -> "infrastructure";
            case "BAS" -> "basement";
            default -> dbType;
        };
    }

    private String mapBlockTypeToDb(String uiType) {
        return switch (uiType) {
            case "residential" -> "Ж";
            case "non_residential" -> "Н";
            case "parking" -> "Parking";
            case "infrastructure" -> "Infra";
            case "basement" -> "BAS";
            default -> uiType;
        };
    }

    private String sanitizeConstructionType(Map<String, Object> buildingData) {
        if (!"parking_separate".equals(s(buildingData.get("category")))) return null;
        String type = s(buildingData.get("constructionType"));
        if ("capital".equals(type)) return "integrated";
        return type;
    }

    private String sanitizeParkingType(Map<String, Object> buildingData) {
        if (!"parking_separate".equals(s(buildingData.get("category")))) return null;
        String parkingType = s(buildingData.get("parkingType"));
        return "ground".equals(parkingType) ? "aboveground" : parkingType;
    }

    private String sanitizeInfraType(Map<String, Object> buildingData) {
        return "infrastructure".equals(s(buildingData.get("category"))) ? s(buildingData.get("infraType")) : null;
    }

    private boolean canHaveBasements(Map<String, Object> buildingData) {
        String category = s(buildingData.get("category"));
        if (!"parking_separate".equals(category)) return true;

        String parkingType = s(buildingData.get("parkingType"));
        String constructionType = s(buildingData.get("constructionType"));
        if ("aboveground".equals(parkingType) && ("light".equals(constructionType) || "open".equals(constructionType))) {
            return false;
        }
        return true;
    }

    private int resolveBasementCount(Map<String, Object> buildingData) {
        int num = n(buildingData.get("basementsCount"), n(buildingData.get("basementCount"), 0));
        if (num <= 0) return 0;
        return Math.min(num, 10);
    }

    private String normalizeParkingTypeFromDb(String parkingType) {
        if ("aboveground".equals(parkingType)) return "ground";
        return parkingType;
    }

    private String normalizeParkingConstructionFromDb(String constructionType) {
        if ("separate".equals(constructionType) || "integrated".equals(constructionType)) return "capital";
        return constructionType;
    }

 private void assignGeometry(UUID projectId, UUID buildingId, UUID candidateId) {
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

        } catch (org.springframework.dao.DataAccessException e) {
            e.printStackTrace();
            throw new ApiException("Geometry validation failed", "GEOMETRY_VALIDATION_ERROR", e.getMessage(), 400);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((k, v) -> result.put(String.valueOf(k), v));
            return result;
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream().map(this::asMap).toList();
        }
        return List.of();
    }

    private int n(Object value, int fallback) {
        if (value == null) return fallback;
        try { return Integer.parseInt(String.valueOf(value)); } catch (Exception e) { return fallback; }
    }

    private boolean b(Object value) {
        return value != null && (value instanceof Boolean v ? v : Boolean.parseBoolean(String.valueOf(value)));
    }

    private String s(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception e) {
            throw new ApiException("JSON_SERIALIZE_ERROR", "INTERNAL_ERROR", e.getMessage(), 500);
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
    private Object parseJsonb(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.readTree(value.toString());
        } catch (Exception e) {
            return value.toString();
        }
    }

    private List<?> parseSqlArray(Object value) {
        if (value == null) return List.of();
        if (value instanceof java.sql.Array arr) {
            try {
                return Arrays.asList((Object[]) arr.getArray());
            } catch (Exception e) {
                return List.of();
            }
        }
        if (value instanceof Object[] arr) {
            return Arrays.asList(arr);
        }
        return List.of();
    }
}
