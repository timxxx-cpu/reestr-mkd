package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class RegistryService {
    private static final Set<String> EXTENSION_VERTICAL_ANCHORS = Set.of("GROUND", "BLOCK_FLOOR", "ROOF");
    private static final Set<String> EXTENSION_CONSTRUCTION_KINDS = Set.of("capital", "light");
    private final JdbcTemplate jdbc;

    public RegistryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> floors(String blockId) {
        return jdbc.queryForList("""
            select f.*
            from floors f
            where f.block_id = ?
               or f.extension_id in (select id from block_extensions where parent_block_id = ?)
            order by f.index asc
            """, blockId, blockId);
    }

    @Transactional
    public Map<String, Object> updateFloor(String floorId, Map<String, Object> body) {
        Map<String, Object> updates = body == null ? Map.of() : asMap(body.get("updates"));
        if (updates.isEmpty() && body != null) updates = body;

        List<String> sets = new ArrayList<>();
        List<Object> params = new ArrayList<>();

        if (updates.containsKey("height")) {
            sets.add("height=?");
            params.add(parseNullableDecimal(updates.get("height"), "height"));
        }
        if (updates.containsKey("areaProj")) {
            sets.add("area_proj=?");
            params.add(parseNullableDecimal(updates.get("areaProj"), "areaProj"));
        }
        if (updates.containsKey("areaFact")) {
            sets.add("area_fact=?");
            params.add(parseNullableDecimal(updates.get("areaFact"), "areaFact"));
        }
        if (updates.containsKey("isDuplex")) {
            sets.add("is_duplex=?");
            params.add(updates.get("isDuplex"));
        }
        if (updates.containsKey("label")) {
            sets.add("label=?");
            params.add(updates.get("label"));
        }
        if (updates.containsKey("type")) {
            sets.add("floor_type=?");
            params.add(updates.get("type"));
        }
        if (updates.containsKey("isTechnical")) {
            sets.add("is_technical=?");
            params.add(updates.get("isTechnical"));
        }
        if (updates.containsKey("isCommercial")) {
            sets.add("is_commercial=?");
            params.add(updates.get("isCommercial"));
        }

        if (sets.isEmpty()) {
            if (body != null && body.containsKey("floorNumber")) {
                sets.add("floor_number=?");
                params.add(body.get("floorNumber"));
            }
            if (body != null && body.containsKey("floorType")) {
                sets.add("floor_type=?");
                params.add(body.get("floorType"));
            }
        }

        if (sets.isEmpty()) throw new IllegalArgumentException("updates are required");

        sets.add("updated_at=now()");
        String sql = "update floors set " + String.join(", ", sets) + " where id=?";
        params.add(floorId);
        int updated = jdbc.update(sql, params.toArray());
        if (updated == 0) throw new NoSuchElementException("Floor not found");
        return Map.of("ok", true, "updated", updated);
    }

    @Transactional
    public Map<String, Object> updateFloorsBatch(List<Map<String, Object>> items, boolean strict) {
        int updated = 0;
        List<Map<String, Object>> failed = new ArrayList<>();

        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> item = items.get(i);
            String id = stringVal(item == null ? null : item.get("id"));
            if (id == null || id.isBlank()) {
                failed.add(Map.of("index", i, "reason", "id is required"));
                continue;
            }
            try {
                updateFloor(id, Map.of("updates", asMap(item == null ? null : item.get("updates"))));
                updated += 1;
            } catch (RuntimeException ex) {
                failed.add(Map.of("index", i, "id", id, "reason", ex.getMessage() == null ? "Validation error" : ex.getMessage()));
            }
        }

        if (strict && !failed.isEmpty()) {
            throw new IllegalStateException("PARTIAL_UPDATE: " + failed);
        }

        return Map.of("ok", failed.isEmpty(), "updated", updated, "failed", failed);
    }

    @Transactional
    public Map<String, Object> reconcileFloors(String blockId, List<Map<String, Object>> items) {
        Set<String> keep = new HashSet<>();
        for (Map<String, Object> item : items) {
            String id = item.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(item.get("id"));
            keep.add(id);
            jdbc.update("insert into floors(id, block_id, floor_number, floor_type, updated_at) values (?,?,?,?,now()) on conflict (id) do update set floor_number=excluded.floor_number, floor_type=excluded.floor_type, updated_at=now()",
                id, blockId, item.get("floorNumber"), item.get("floorType"));
        }
        if (!keep.isEmpty()) {
            jdbc.update("delete from floors where block_id = ? and id not in (" + placeholders(keep.size()) + ")", combine(blockId, keep));
        }
        return Map.of("ok", true, "count", keep.size());
    }

    public List<Map<String, Object>> entrances(String blockId) {
        return jdbc.queryForList("select * from entrances where block_id = ? order by number asc", blockId);
    }

    public List<Map<String, Object>> entranceMatrix(String blockId) {
        return jdbc.queryForList("select * from entrance_matrix where block_id = ? order by floor_id asc, entrance_number asc", blockId);
    }

    @Transactional
    public Map<String, Object> updateEntranceMatrixCell(String blockId, Map<String, Object> body) {
        String floorId = stringVal(body.get("floorId"));
        int entranceNumber = toInt(body.get("entranceNumber"));
        if (floorId.isBlank() || entranceNumber <= 0) {
            throw new IllegalArgumentException("floorId and entranceNumber are required");
        }

        Map<String, Object> values = asMap(body.get("values"));
        Map<String, Integer> validated = validateMatrixValues(values);

        jdbc.update("""
            insert into entrance_matrix(id, block_id, floor_id, entrance_number, flats_count, commercial_count, mop_count, updated_at)
            values (?,?,?,?,?,?,?,now())
            on conflict (block_id, floor_id, entrance_number) do update set
                flats_count=coalesce(excluded.flats_count, entrance_matrix.flats_count),
                commercial_count=coalesce(excluded.commercial_count, entrance_matrix.commercial_count),
                mop_count=coalesce(excluded.mop_count, entrance_matrix.mop_count),
                updated_at=now()
            """,
            UUID.randomUUID().toString(),
            blockId,
            floorId,
            entranceNumber,
            validated.get("flats_count"),
            validated.get("commercial_count"),
            validated.get("mop_count")
        );

        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> batchUpsertMatrixCells(String blockId, List<Map<String, Object>> cells) {
        int updated = 0;
        List<Map<String, Object>> failed = new ArrayList<>();

        for (int i = 0; i < cells.size(); i++) {
            Map<String, Object> cell = cells.get(i);
            try {
                updateEntranceMatrixCell(blockId, cell == null ? Map.of() : cell);
                updated += 1;
            } catch (RuntimeException ex) {
                failed.add(Map.of("index", i, "reason", ex.getMessage() == null ? "Validation error" : ex.getMessage()));
            }
        }

        return Map.of("ok", true, "updated", updated, "failed", failed);
    }

    public Map<String, Object> previewReconcileByBlock(String blockId) {
        List<Map<String, Object>> floorRows = jdbc.queryForList("select id from floors where block_id = ?", blockId);
        List<String> floorIds = floorRows.stream().map(v -> String.valueOf(v.get("id"))).toList();
        if (floorIds.isEmpty()) {
            return Map.of("units", Map.of("toRemove", 0, "checkedCells", 0), "commonAreas", Map.of("toRemove", 0, "checkedCells", 0));
        }

        List<Map<String, Object>> entrances = jdbc.queryForList("select id, number from entrances where block_id = ?", blockId);
        Map<Integer, String> entranceByNumber = new HashMap<>();
        for (Map<String, Object> e : entrances) {
            entranceByNumber.put(toInt(e.get("number")), String.valueOf(e.get("id")));
        }

        List<Map<String, Object>> matrixRows = jdbc.queryForList("select floor_id, entrance_number, flats_count, commercial_count, mop_count from entrance_matrix where block_id = ?", blockId);
        Map<String, Integer> desiredFlats = new HashMap<>();
        Map<String, Integer> desiredCommercial = new HashMap<>();
        Map<String, Integer> desiredMops = new HashMap<>();
        for (Map<String, Object> row : matrixRows) {
            String entranceId = entranceByNumber.get(toInt(row.get("entrance_number")));
            if (entranceId == null) continue;
            String key = String.valueOf(row.get("floor_id")) + "_" + entranceId;
            desiredFlats.put(key, Math.max(0, toInt(row.get("flats_count"))));
            desiredCommercial.put(key, Math.max(0, toInt(row.get("commercial_count"))));
            desiredMops.put(key, Math.max(0, toInt(row.get("mop_count"))));
        }

        String inFloors = placeholders(floorIds.size());
        List<Map<String, Object>> unitRows = jdbc.queryForList("select floor_id, entrance_id, unit_type from units where floor_id in (" + inFloors + ")", floorIds.toArray());

        Map<String, Integer> actualFlats = new HashMap<>();
        Map<String, Integer> actualCommercial = new HashMap<>();
        for (Map<String, Object> row : unitRows) {
            String key = String.valueOf(row.get("floor_id")) + "_" + String.valueOf(row.get("entrance_id"));
            String type = String.valueOf(row.get("unit_type"));
            if (List.of("flat", "duplex_up", "duplex_down").contains(type)) {
                actualFlats.put(key, actualFlats.getOrDefault(key, 0) + 1);
            } else if (List.of("office", "office_inventory", "non_res_block", "infrastructure").contains(type)) {
                actualCommercial.put(key, actualCommercial.getOrDefault(key, 0) + 1);
            }
        }

        int unitsToRemove = 0;
        Set<String> unitKeys = new HashSet<>();
        unitKeys.addAll(actualFlats.keySet());
        unitKeys.addAll(actualCommercial.keySet());
        for (String key : unitKeys) {
            unitsToRemove += Math.max(0, actualFlats.getOrDefault(key, 0) - desiredFlats.getOrDefault(key, 0));
            unitsToRemove += Math.max(0, actualCommercial.getOrDefault(key, 0) - desiredCommercial.getOrDefault(key, 0));
        }

        List<Map<String, Object>> areaRows = jdbc.queryForList("select floor_id, entrance_id from common_areas where floor_id in (" + inFloors + ")", floorIds.toArray());
        Map<String, Integer> actualMops = new HashMap<>();
        for (Map<String, Object> row : areaRows) {
            String key = String.valueOf(row.get("floor_id")) + "_" + String.valueOf(row.get("entrance_id"));
            actualMops.put(key, actualMops.getOrDefault(key, 0) + 1);
        }

        int mopsToRemove = 0;
        for (String key : actualMops.keySet()) {
            mopsToRemove += Math.max(0, actualMops.getOrDefault(key, 0) - desiredMops.getOrDefault(key, 0));
        }

        return Map.of(
            "units", Map.of("toRemove", unitsToRemove, "checkedCells", unitKeys.size()),
            "commonAreas", Map.of("toRemove", mopsToRemove, "checkedCells", actualMops.size())
        );
    }

    @Transactional
    public Map<String, Object> reconcileEntrances(String blockId, List<Map<String, Object>> items) {
        Set<String> keep = new HashSet<>();
        for (Map<String, Object> item : items) {
            String id = item.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(item.get("id"));
            keep.add(id);
            jdbc.update("insert into entrances(id, block_id, number, updated_at) values (?,?,?,now()) on conflict (id) do update set number=excluded.number, updated_at=now()",
                id, blockId, item.get("number"));
        }
        if (!keep.isEmpty()) {
            jdbc.update("delete from entrances where block_id = ? and id not in (" + placeholders(keep.size()) + ")", combine(blockId, keep));
        }
        return Map.of("ok", true, "count", keep.size());
    }

    public Map<String, Object> units(String blockId) {
        List<Map<String, Object>> floorRows = jdbc.queryForList("select id from floors where block_id = ?", blockId);
        if (floorRows.isEmpty()) return Map.of("units", List.of(), "entranceMap", Map.of());

        List<String> floorIds = floorRows.stream().map(v -> String.valueOf(v.get("id"))).toList();
        String inFloors = placeholders(floorIds.size());
        List<Map<String, Object>> units = jdbc.queryForList("select * from units where floor_id in (" + inFloors + ")", floorIds.toArray());

        List<Map<String, Object>> entrances = jdbc.queryForList("select id, number from entrances where block_id = ?", blockId);
        Map<String, Object> entranceMap = new HashMap<>();
        for (Map<String, Object> e : entrances) entranceMap.put(String.valueOf(e.get("id")), e.get("number"));

        return Map.of("units", units, "entranceMap", entranceMap);
    }

    @Transactional
    public Map<String, Object> reconcileUnits(String blockId, List<Map<String, Object>> items) {
        var floorRows = jdbc.queryForList("select id from floors where block_id = ?", blockId);
        List<String> floorIds = floorRows.stream().map(v -> String.valueOf(v.get("id"))).toList();

        Set<String> keep = new HashSet<>();
        for (Map<String, Object> item : items) {
            String id = String.valueOf(upsertUnit(item).get("id"));
            keep.add(id);
        }

        if (!floorIds.isEmpty() && !keep.isEmpty()) {
            jdbc.update(
                "delete from units where floor_id in (" + placeholders(floorIds.size()) + ") and id not in (" + placeholders(keep.size()) + ")",
                combine(floorIds, keep)
            );
        }
        return Map.of("ok", true, "count", keep.size());
    }

    public List<Map<String, Object>> explication(String unitId) {
        return jdbc.queryForList("select * from rooms where unit_id = ? order by created_at asc", unitId);
    }

    @Transactional
    public Map<String, Object> syncParkingPlaces(String floorId, List<Map<String, Object>> places) {
        jdbc.update("delete from units where floor_id = ? and unit_type = 'parking'", floorId);
        for (Map<String, Object> place : places) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("id", place.getOrDefault("id", UUID.randomUUID().toString()));
            payload.put("floorId", floorId);
            payload.put("entranceId", place.get("entranceId"));
            payload.put("unitCode", place.get("unitCode"));
            payload.put("number", place.get("number"));
            payload.put("type", "parking");
            payload.put("area", place.get("area"));
            payload.put("livingArea", 0);
            payload.put("usefulArea", 0);
            payload.put("rooms", 0);
            payload.put("hasMezzanine", false);
            payload.put("mezzanineType", null);
            payload.put("status", place.getOrDefault("status", "free"));
            upsertUnit(payload);
        }
        return Map.of("ok", true, "count", places.size());
    }

    @Transactional
    public Map<String, Object> upsertUnit(Map<String, Object> body) {
        String id = body.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("id"));
        jdbc.update("insert into units(id, floor_id, entrance_id, unit_code, number, unit_type, total_area, living_area, useful_area, rooms_count, has_mezzanine, mezzanine_type, status, updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,now()) on conflict (id) do update set floor_id=excluded.floor_id, entrance_id=excluded.entrance_id, unit_code=excluded.unit_code, number=excluded.number, unit_type=excluded.unit_type, total_area=excluded.total_area, living_area=excluded.living_area, useful_area=excluded.useful_area, rooms_count=excluded.rooms_count, has_mezzanine=excluded.has_mezzanine, mezzanine_type=excluded.mezzanine_type, status=excluded.status, updated_at=now()",
            id, body.get("floorId"), body.get("entranceId"), body.get("unitCode"), body.getOrDefault("number", body.get("num")), body.get("type"), body.get("area"), body.get("livingArea"), body.get("usefulArea"), body.get("rooms"), body.get("hasMezzanine"), body.get("mezzanineType"), body.get("status"));
        return Map.of("id", id);
    }

    @Transactional
    public Map<String, Object> batchUpsertUnits(List<Map<String, Object>> units) {
        List<Map<String, Object>> saved = new ArrayList<>();
        for (Map<String, Object> unit : units) saved.add(upsertUnit(unit));
        return Map.of("ok", true, "items", saved);
    }


    public List<Map<String, Object>> listExtensions(String blockId) {
        return jdbc.queryForList("select * from block_extensions where parent_block_id = ? order by created_at asc", blockId);
    }

    @Transactional
    public Map<String, Object> createExtension(String blockId, Map<String, Object> body) {
        Map<String, Object> extensionData = asMap(body == null ? null : body.get("extensionData"));
        Map<String, Object> normalized = normalizeExtensionPayload(extensionData);

        List<Map<String, Object>> blockRows = jdbc.queryForList("select building_id from building_blocks where id = ?", blockId);
        if (blockRows.isEmpty()) throw new NoSuchElementException("Block not found");
        String id = UUID.randomUUID().toString();

        jdbc.update("""
            insert into block_extensions(id, building_id, parent_block_id, label, extension_type, construction_kind, floors_count, start_floor_index, vertical_anchor_type, anchor_floor_key, notes, updated_at)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
            """,
            id,
            blockRows.get(0).get("building_id"),
            blockId,
            normalized.get("label"),
            normalized.get("extension_type"),
            normalized.get("construction_kind"),
            normalized.get("floors_count"),
            normalized.get("start_floor_index"),
            normalized.get("vertical_anchor_type"),
            normalized.get("anchor_floor_key"),
            normalized.get("notes")
        );

        syncExtensionFloors(id);
        return jdbc.queryForMap("select * from block_extensions where id = ?", id);
    }

    @Transactional
    public Map<String, Object> updateExtension(String extensionId, Map<String, Object> body) {
        Map<String, Object> extensionData = asMap(body == null ? null : body.get("extensionData"));
        Map<String, Object> normalized = normalizeExtensionPayload(extensionData);

        int updated = jdbc.update("""
            update block_extensions
            set label = ?,
                extension_type = ?,
                construction_kind = ?,
                floors_count = ?,
                start_floor_index = ?,
                vertical_anchor_type = ?,
                anchor_floor_key = ?,
                notes = ?,
                updated_at = now()
            where id = ?
            """,
            normalized.get("label"),
            normalized.get("extension_type"),
            normalized.get("construction_kind"),
            normalized.get("floors_count"),
            normalized.get("start_floor_index"),
            normalized.get("vertical_anchor_type"),
            normalized.get("anchor_floor_key"),
            normalized.get("notes"),
            extensionId
        );

        if (updated == 0) throw new NoSuchElementException("Extension not found");
        syncExtensionFloors(extensionId);
        return jdbc.queryForMap("select * from block_extensions where id = ?", extensionId);
    }

    @Transactional
    public Map<String, Object> deleteExtension(String extensionId) {
        int updated = jdbc.update("delete from block_extensions where id = ?", extensionId);
        if (updated == 0) throw new NoSuchElementException("Extension not found");
        return Map.of("ok", true, "id", extensionId);
    }

    private void syncExtensionFloors(String extensionId) {
        Map<String, Object> extension = jdbc.queryForMap("select id, parent_block_id, floors_count, start_floor_index from block_extensions where id = ?", extensionId);
        int floorsCount = Math.max(1, toInt(extension.get("floors_count")));
        int startFloorIndex = Math.max(1, toInt(extension.get("start_floor_index")));

        List<Map<String, Object>> existing = jdbc.queryForList("select id, index from floors where extension_id = ?", extensionId);
        Map<Integer, String> existingByIndex = new HashMap<>();
        for (Map<String, Object> row : existing) {
            existingByIndex.put(toInt(row.get("index")), String.valueOf(row.get("id")));
        }

        Set<Integer> target = new HashSet<>();
        for (int i = 0; i < floorsCount; i++) {
            int idx = startFloorIndex + i;
            target.add(idx);
            String floorId = existingByIndex.getOrDefault(idx, UUID.randomUUID().toString());
            jdbc.update("""
                insert into floors(id, block_id, extension_id, index, floor_key, label, floor_type, parent_floor_index, basement_id, updated_at)
                values (?, null, ?, ?, ?, ?, ?, null, null, now())
                on conflict (id) do update set
                    block_id = excluded.block_id,
                    extension_id = excluded.extension_id,
                    index = excluded.index,
                    floor_key = excluded.floor_key,
                    label = excluded.label,
                    floor_type = excluded.floor_type,
                    parent_floor_index = excluded.parent_floor_index,
                    basement_id = excluded.basement_id,
                    updated_at = now()
                """,
                floorId,
                extensionId,
                idx,
                "extension:" + extensionId + ":" + idx,
                idx + " этаж",
                "residential"
            );
        }

        List<String> deleteIds = new ArrayList<>();
        for (Map<String, Object> row : existing) {
            int idx = toInt(row.get("index"));
            if (!target.contains(idx)) deleteIds.add(String.valueOf(row.get("id")));
        }
        if (!deleteIds.isEmpty()) {
            jdbc.update("delete from floors where id in (" + placeholders(deleteIds.size()) + ")", deleteIds.toArray());
        }
    }

    public List<Map<String, Object>> commonAreas(String blockId) {
        return jdbc.queryForList("select * from common_areas where block_id = ? order by created_at asc", blockId);
    }

    @Transactional
    public Map<String, Object> upsertCommonArea(Map<String, Object> body) {
        String id = body.get("id") == null ? UUID.randomUUID().toString() : String.valueOf(body.get("id"));
        jdbc.update("insert into common_areas(id, block_id, floor_id, area_type, area, count, updated_at) values (?,?,?,?,?,?,now()) on conflict (id) do update set block_id=excluded.block_id, floor_id=excluded.floor_id, area_type=excluded.area_type, area=excluded.area, count=excluded.count, updated_at=now()",
            id, body.get("blockId"), body.get("floorId"), body.get("type"), body.get("area"), body.get("count"));
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> deleteCommonArea(String id) {
        jdbc.update("delete from common_areas where id=?", id);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> clearCommonAreas(String blockId) {
        jdbc.update("delete from common_areas where block_id=?", blockId);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> reconcileCommonAreas(String blockId, List<Map<String, Object>> items) {
        Set<String> keep = new HashSet<>();
        for (Map<String, Object> item : items) {
            Map<String, Object> payload = new HashMap<>(item);
            payload.put("blockId", blockId);
            String id = String.valueOf(upsertCommonArea(payload).get("id"));
            keep.add(id);
        }
        if (!keep.isEmpty()) {
            jdbc.update("delete from common_areas where block_id = ? and id not in (" + placeholders(keep.size()) + ")", combine(blockId, keep));
        }
        return Map.of("ok", true, "count", keep.size());
    }



    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
        return Map.of();
    }


    private Map<String, Object> normalizeExtensionPayload(Map<String, Object> payload) {
        String label = String.valueOf(payload.getOrDefault("label", "")).trim();
        if (label.isEmpty()) throw new IllegalArgumentException("label is required");

        int floorsCount = toInt(payload.get("floorsCount"));
        if (floorsCount < 1) throw new IllegalArgumentException("floorsCount must be an integer >= 1");

        int startFloorIndex = toInt(payload.get("startFloorIndex"));
        if (startFloorIndex < 1) throw new IllegalArgumentException("startFloorIndex must be an integer >= 1");

        String extensionType = String.valueOf(payload.getOrDefault("extensionType", "OTHER")).trim().toUpperCase(Locale.ROOT);
        String constructionKind = String.valueOf(payload.getOrDefault("constructionKind", "capital")).trim().toLowerCase(Locale.ROOT);
        if (!EXTENSION_CONSTRUCTION_KINDS.contains(constructionKind)) {
            throw new IllegalArgumentException("constructionKind must be one of: capital, light");
        }

        String verticalAnchorType = String.valueOf(payload.getOrDefault("verticalAnchorType", "GROUND")).trim().toUpperCase(Locale.ROOT);
        if (!EXTENSION_VERTICAL_ANCHORS.contains(verticalAnchorType)) {
            throw new IllegalArgumentException("verticalAnchorType must be one of: GROUND, BLOCK_FLOOR, ROOF");
        }

        String anchorFloorRaw = payload.get("anchorFloorKey") == null ? null : String.valueOf(payload.get("anchorFloorKey")).trim();
        String anchorFloorKey = anchorFloorRaw == null || anchorFloorRaw.isEmpty() ? null : anchorFloorRaw;

        if ("GROUND".equals(verticalAnchorType) && anchorFloorKey != null) {
            throw new IllegalArgumentException("anchorFloorKey must be null when verticalAnchorType=GROUND");
        }
        if (!"GROUND".equals(verticalAnchorType) && anchorFloorKey == null) {
            throw new IllegalArgumentException("anchorFloorKey is required when verticalAnchorType is BLOCK_FLOOR or ROOF");
        }

        String notes = payload.get("notes") == null ? null : String.valueOf(payload.get("notes")).trim();
        if (notes != null && notes.isEmpty()) notes = null;

        Map<String, Object> normalized = new HashMap<>();
        normalized.put("label", label);
        normalized.put("extension_type", extensionType);
        normalized.put("construction_kind", constructionKind);
        normalized.put("floors_count", floorsCount);
        normalized.put("start_floor_index", startFloorIndex);
        normalized.put("vertical_anchor_type", verticalAnchorType);
        normalized.put("anchor_floor_key", "GROUND".equals(verticalAnchorType) ? null : anchorFloorKey);
        normalized.put("notes", notes);
        return normalized;
    }

    private Map<String, Integer> validateMatrixValues(Map<String, Object> values) {
        boolean hasAny = values.containsKey("apts") || values.containsKey("units") || values.containsKey("mopQty");
        if (!hasAny) throw new IllegalArgumentException("values must include at least one field: apts, units, mopQty");

        int maxAllowed = 500;
        Map<String, Integer> payload = new HashMap<>();
        if (values.containsKey("apts")) {
            Integer parsed = parseOptionalNonNegativeInt(values.get("apts"));
            if (parsed != null && parsed > maxAllowed) throw new IllegalArgumentException("apts must be <= " + maxAllowed);
            payload.put("flats_count", parsed);
        }
        if (values.containsKey("units")) {
            Integer parsed = parseOptionalNonNegativeInt(values.get("units"));
            if (parsed != null && parsed > maxAllowed) throw new IllegalArgumentException("units must be <= " + maxAllowed);
            payload.put("commercial_count", parsed);
        }
        if (values.containsKey("mopQty")) {
            Integer parsed = parseOptionalNonNegativeInt(values.get("mopQty"));
            if (parsed != null && parsed > maxAllowed) throw new IllegalArgumentException("mopQty must be <= " + maxAllowed);
            payload.put("mop_count", parsed);
        }
        return payload;
    }

    private Integer parseOptionalNonNegativeInt(Object value) {
        if (value == null) return null;
        String raw = String.valueOf(value).trim();
        if (raw.isEmpty()) return null;
        try {
            int parsed = Integer.parseInt(raw);
            if (parsed < 0) throw new IllegalArgumentException("value must be non-negative integer");
            return parsed;
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("value must be non-negative integer");
        }
    }

    private String stringVal(Object value) {
        if (value == null) return "";
        return String.valueOf(value).trim();
    }

    private int toInt(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (NumberFormatException e) { return 0; }
    }



    private Double parseNullableDecimal(Object value, String fieldName) {
        if (value == null) return null;
        String raw = String.valueOf(value).trim();
        if (raw.isEmpty()) return null;
        raw = raw.replace(',', '.');
        try {
            return Double.parseDouble(raw);
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException(fieldName + " must be a valid number or empty");
        }
    }

    private String placeholders(int count) {
        return String.join(",", Collections.nCopies(count, "?"));
    }

    private Object[] combine(String first, Set<String> ids) {
        List<Object> args = new ArrayList<>();
        args.add(first);
        args.addAll(ids);
        return args.toArray();
    }

    private Object[] combine(List<String> firstIds, Set<String> secondIds) {
        List<Object> args = new ArrayList<>();
        args.addAll(firstIds);
        args.addAll(secondIds);
        return args.toArray();
    }
}
