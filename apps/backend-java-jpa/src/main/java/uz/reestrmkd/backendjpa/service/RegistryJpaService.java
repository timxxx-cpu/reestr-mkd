package uz.reestrmkd.backendjpa.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import jakarta.persistence.Tuple;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@Service
@RequiredArgsConstructor
public class RegistryJpaService {

    private static final Set<String> EXTENSION_VERTICAL_ANCHORS = Set.of("GROUND", "BLOCK_FLOOR", "ROOF");
    private static final Set<String> EXTENSION_CONSTRUCTION_KINDS = Set.of("capital", "light");

    private Map<String, Object> normalizeExtensionPayload(Map<String, Object> payload) {
        String label = stringValOr(payload == null ? null : payload.get("label"), "").trim();
        if (label.isEmpty()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "label is required");

        int floorsCount = toInt(payload == null ? null : payload.get("floorsCount"));
        if (floorsCount < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorsCount must be an integer >= 1");

        int startFloorIndex = toInt(payload == null ? null : payload.get("startFloorIndex"));
        if (startFloorIndex < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startFloorIndex must be an integer >= 1");

        String extensionType = stringValOr(payload == null ? null : payload.get("extensionType"), "OTHER").trim().toUpperCase(Locale.ROOT);
        String constructionKind = stringValOr(payload == null ? null : payload.get("constructionKind"), "capital").trim().toLowerCase(Locale.ROOT);
        if (!EXTENSION_CONSTRUCTION_KINDS.contains(constructionKind)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "constructionKind must be one of: capital, light");
        }

        String verticalAnchorType = stringValOr(payload == null ? null : payload.get("verticalAnchorType"), "GROUND").trim().toUpperCase(Locale.ROOT);
        if (!EXTENSION_VERTICAL_ANCHORS.contains(verticalAnchorType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "verticalAnchorType must be one of: GROUND, BLOCK_FLOOR, ROOF");
        }

        String anchorFloorRaw = payload == null ? null : stringValOr(payload.get("anchorFloorKey"), "").trim();
        String anchorFloorKey = anchorFloorRaw == null || anchorFloorRaw.isEmpty() ? null : anchorFloorRaw;

        if ("GROUND".equals(verticalAnchorType) && anchorFloorKey != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "anchorFloorKey must be null when verticalAnchorType=GROUND");
        }
        if (!"GROUND".equals(verticalAnchorType) && (anchorFloorKey == null || anchorFloorKey.isEmpty())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "anchorFloorKey is required when verticalAnchorType is BLOCK_FLOOR or ROOF");
        }

        String notes = payload == null || payload.get("notes") == null ? null : stringValOr(payload.get("notes"), "").trim();
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

    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> floors(String blockId) {
        return queryList("""
            select f.*
            from floors f
            where f.block_id = :blockId
               or f.extension_id in (select id from block_extensions where parent_block_id = :blockId)
            order by f.index asc
            """, Map.of("blockId", blockId));
    }

    @Transactional
    public Map<String, Object> updateFloor(String floorId, Map<String, Object> body) {
        Map<String, Object> updates = mapFrom(body == null ? null : body.get("updates"));
        if (updates.isEmpty() && body != null) updates = body;

        List<String> sets = new ArrayList<>();
        Map<String, Object> params = new HashMap<>();
        params.put("id", floorId);

        if (updates.containsKey("height")) { sets.add("height = :height"); params.put("height", updates.get("height")); }
        if (updates.containsKey("areaProj")) { sets.add("area_proj = :areaProj"); params.put("areaProj", updates.get("areaProj")); }
        if (updates.containsKey("areaFact")) { sets.add("area_fact = :areaFact"); params.put("areaFact", updates.get("areaFact")); }
        if (updates.containsKey("isDuplex")) { sets.add("is_duplex = :isDuplex"); params.put("isDuplex", updates.get("isDuplex")); }
        if (updates.containsKey("label")) { sets.add("label = :label"); params.put("label", updates.get("label")); }
        if (updates.containsKey("type")) { sets.add("floor_type = :floorType"); params.put("floorType", updates.get("type")); }
        if (updates.containsKey("isTechnical")) { sets.add("is_technical = :isTechnical"); params.put("isTechnical", updates.get("isTechnical")); }
        if (updates.containsKey("isCommercial")) { sets.add("is_commercial = :isCommercial"); params.put("isCommercial", updates.get("isCommercial")); }

        if (sets.isEmpty()) {
            if (body != null && body.containsKey("floorNumber")) { sets.add("floor_number = :floorNumber"); params.put("floorNumber", body.get("floorNumber")); }
            if (body != null && body.containsKey("floorType")) { sets.add("floor_type = :legacyFloorType"); params.put("legacyFloorType", body.get("floorType")); }
        }

        if (sets.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "updates are required");
        }

        sets.add("updated_at = now()");
        String sql = "update floors set " + String.join(", ", sets) + " where id = :id";
        Query q = em.createNativeQuery(sql);
        params.forEach(q::setParameter);
        int affected = q.executeUpdate();
        if (affected == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Floor not found");
        }
        return Map.of("ok", true, "updated", affected);
    }

    @Transactional
    public Map<String, Object> updateFloorsBatch(List<Map<String, Object>> items, boolean strict) {
        int updated = 0;
        List<Map<String, Object>> failed = new ArrayList<>();

        for (int i = 0; i < items.size(); i++) {
            Map<String, Object> item = items.get(i);
            String id = stringValOr(item == null ? null : item.get("id"), "");
            if (id.isBlank()) {
                failed.add(Map.of("index", i, "reason", "id is required"));
                continue;
            }
            try {
                Map<String, Object> body = Map.of("updates", mapFrom(item == null ? null : item.get("updates")));
                updateFloor(id, body);
                updated += 1;
            } catch (ResponseStatusException ex) {
                failed.add(Map.of("index", i, "id", id, "reason", ex.getReason() == null ? "Validation error" : ex.getReason()));
            }
        }

        if (strict && !failed.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "One or more floors cannot be updated");
        }

        return Map.of("ok", failed.isEmpty(), "updated", updated, "failed", failed);
    }

    @Transactional
    public Map<String, Object> reconcileFloors(String blockId, List<Map<String, Object>> items) {
        Set<String> keep = new LinkedHashSet<>();
        for (Map<String, Object> item : items) {
            String id = stringValOr(item.get("id"), UUID.randomUUID().toString());
            keep.add(id);
            execute("""
                insert into floors(id, block_id, floor_number, floor_type, updated_at)
                values (:id,:blockId,:floorNumber,:floorType,now())
                on conflict (id) do update
                set floor_number=excluded.floor_number, floor_type=excluded.floor_type, updated_at=now()
                """, Map.of("id", id, "blockId", blockId, "floorNumber", item.get("floorNumber"), "floorType", item.get("floorType")));
        }
        if (!keep.isEmpty()) {
            StringBuilder sql = new StringBuilder("delete from floors where block_id = :blockId and id not in (");
            Map<String, Object> params = new HashMap<>();
            params.put("blockId", blockId);
            int i = 0;
            for (String id : keep) {
                if (i > 0) sql.append(',');
                String key = "id" + i;
                sql.append(':').append(key);
                params.put(key, id);
                i++;
            }
            sql.append(')');
            execute(sql.toString(), params);
        }
        return Map.of("ok", true, "count", keep.size());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> entrances(String blockId) {
        return queryList("select * from entrances where block_id = :blockId order by entrance_number asc", Map.of("blockId", blockId));
    }

    @Transactional
    public Map<String, Object> reconcileEntrances(String blockId, List<Map<String, Object>> items) {
        Set<String> keep = new LinkedHashSet<>();
        for (Map<String, Object> item : items) {
            String id = stringValOr(item.get("id"), UUID.randomUUID().toString());
            keep.add(id);
            execute("""
                insert into entrances(id, block_id, entrance_number, updated_at)
                values (:id,:blockId,:entranceNumber,now())
                on conflict (id) do update
                set entrance_number=excluded.entrance_number, updated_at=now()
                """, Map.of("id", id, "blockId", blockId, "entranceNumber", item.get("entranceNumber")));
        }
        if (!keep.isEmpty()) {
            StringBuilder sql = new StringBuilder("delete from entrances where block_id = :blockId and id not in (");
            Map<String, Object> params = new HashMap<>();
            params.put("blockId", blockId);
            int i = 0;
            for (String id : keep) {
                if (i > 0) sql.append(',');
                String key = "id" + i;
                sql.append(':').append(key);
                params.put(key, id);
                i++;
            }
            sql.append(')');
            execute(sql.toString(), params);
        }
        return Map.of("ok", true, "count", keep.size());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> entranceMatrix(String blockId) {
        return queryList("select * from entrance_matrix where block_id = :blockId order by floor_id asc, entrance_number asc", Map.of("blockId", blockId));
    }

    @Transactional
    public Map<String, Object> upsertMatrixCell(String blockId, Map<String, Object> body) {
        String floorId = stringValOr(body.get("floorId"), "");
        int entranceNumber = toInt(body.get("entranceNumber"));
        if (floorId.isBlank() || entranceNumber <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorId and entranceNumber are required");
        }

        Map<String, Object> values = mapFrom(body.get("values"));
        Map<String, Object> payloadValues = validateMatrixValues(values);

        Map<String, Object> params = new HashMap<>();
        params.put("id", stringValOr(body.get("id"), UUID.randomUUID().toString()));
        params.put("blockId", blockId);
        params.put("floorId", floorId);
        params.put("entranceNumber", entranceNumber);
        params.put("flatsCount", payloadValues.get("flats_count"));
        params.put("commercialCount", payloadValues.get("commercial_count"));
        params.put("mopCount", payloadValues.get("mop_count"));

        execute("""
            insert into entrance_matrix(id, block_id, floor_id, entrance_number, flats_count, commercial_count, mop_count, updated_at)
            values (:id,:blockId,:floorId,:entranceNumber,:flatsCount,:commercialCount,:mopCount,now())
            on conflict (block_id, floor_id, entrance_number) do update
            set flats_count=coalesce(excluded.flats_count, entrance_matrix.flats_count),
                commercial_count=coalesce(excluded.commercial_count, entrance_matrix.commercial_count),
                mop_count=coalesce(excluded.mop_count, entrance_matrix.mop_count),
                updated_at=now()
            """, params);
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> batchUpsertMatrixCells(String blockId, List<Map<String, Object>> cells) {
        int updated = 0;
        List<Map<String, Object>> failed = new ArrayList<>();

        for (int i = 0; i < cells.size(); i++) {
            Map<String, Object> cell = cells.get(i);
            try {
                upsertMatrixCell(blockId, cell == null ? Map.of() : cell);
                updated += 1;
            } catch (ResponseStatusException ex) {
                failed.add(Map.of("index", i, "reason", ex.getReason() == null ? "Validation error" : ex.getReason()));
            }
        }

        return Map.of("ok", true, "updated", updated, "failed", failed);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> previewReconcileByBlock(String blockId) {
        List<Map<String, Object>> floorRows = queryList("select id from floors where block_id = :blockId", Map.of("blockId", blockId));
        List<String> floorIds = floorRows.stream().map(v -> String.valueOf(v.get("id"))).toList();
        if (floorIds.isEmpty()) {
            return Map.of("units", Map.of("toRemove", 0, "checkedCells", 0), "commonAreas", Map.of("toRemove", 0, "checkedCells", 0));
        }

        List<Map<String, Object>> entranceRows = queryList("select id, number from entrances where block_id = :blockId", Map.of("blockId", blockId));
        Map<Integer, String> entranceByNumber = new HashMap<>();
        for (Map<String, Object> row : entranceRows) {
            entranceByNumber.put(toInt(row.get("number")), String.valueOf(row.get("id")));
        }

        List<Map<String, Object>> matrixRows = queryList("""
            select floor_id, entrance_number, flats_count, commercial_count, mop_count
            from entrance_matrix
            where block_id = :blockId
            """, Map.of("blockId", blockId));

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

        String floorsIn = namedInClause("f", floorIds.size());
        Map<String, Object> floorParams = mapForInClause("f", floorIds);

        List<Map<String, Object>> units = queryList("""
            select id, floor_id, entrance_id, unit_type
            from units
            where floor_id in (""" + floorsIn + ")", floorParams);

        Map<String, Integer> actualFlats = new HashMap<>();
        Map<String, Integer> actualCommercial = new HashMap<>();
        for (Map<String, Object> row : units) {
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

        List<Map<String, Object>> areas = queryList("""
            select id, floor_id, entrance_id
            from common_areas
            where floor_id in (""" + floorsIn + ")", floorParams);
        Map<String, Integer> actualMops = new HashMap<>();
        for (Map<String, Object> row : areas) {
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

    @Transactional(readOnly = true)
    public List<Map<String, Object>> units(String blockId) {
        return queryList("""
            select u.* from units u
            join floors f on f.id = u.floor_id
            where f.block_id = :blockId
            order by u.created_at asc
            """, Map.of("blockId", blockId));
    }

    @Transactional
    public Map<String, Object> upsertUnit(Map<String, Object> body) {
        String id = stringValOr(body.get("id"), UUID.randomUUID().toString());
        Map<String, Object> params = new HashMap<>();
        params.put("id", id);
        params.put("floorId", body.get("floorId"));
        params.put("entranceId", body.get("entranceId"));
        params.put("unitCode", body.get("unitCode"));
        params.put("number", body.getOrDefault("number", body.get("num")));
        params.put("type", body.get("type"));
        params.put("area", body.get("area"));
        params.put("livingArea", body.get("livingArea"));
        params.put("usefulArea", body.get("usefulArea"));
        params.put("rooms", body.get("rooms"));
        params.put("hasMezzanine", body.get("hasMezzanine"));
        params.put("mezzanineType", body.get("mezzanineType"));
        params.put("status", body.get("status"));

        execute("""
            insert into units(id, floor_id, entrance_id, unit_code, number, unit_type, total_area, living_area, useful_area,
                              rooms_count, has_mezzanine, mezzanine_type, status, updated_at)
            values (:id,:floorId,:entranceId,:unitCode,:number,:type,:area,:livingArea,:usefulArea,:rooms,:hasMezzanine,:mezzanineType,:status,now())
            on conflict (id) do update set
                floor_id=excluded.floor_id, entrance_id=excluded.entrance_id, unit_code=excluded.unit_code,
                number=excluded.number, unit_type=excluded.unit_type, total_area=excluded.total_area,
                living_area=excluded.living_area, useful_area=excluded.useful_area, rooms_count=excluded.rooms_count,
                has_mezzanine=excluded.has_mezzanine, mezzanine_type=excluded.mezzanine_type, status=excluded.status, updated_at=now()
            """, params);
        return Map.of("id", id);
    }

    @Transactional
    public Map<String, Object> batchUpsertUnits(List<Map<String, Object>> units) {
        List<Map<String, Object>> saved = new ArrayList<>();
        for (Map<String, Object> unit : units) saved.add(upsertUnit(unit));
        return Map.of("ok", true, "items", saved);
    }

    @Transactional
    public Map<String, Object> reconcileUnits(String blockId, List<Map<String, Object>> items) {
        List<Map<String, Object>> floorRows = queryList("select id from floors where block_id = :blockId", Map.of("blockId", blockId));
        List<String> floorIds = floorRows.stream().map(v -> String.valueOf(v.get("id"))).toList();

        Set<String> keep = new LinkedHashSet<>();
        for (Map<String, Object> item : items) {
            String id = String.valueOf(upsertUnit(item).get("id"));
            keep.add(id);
        }

        if (!floorIds.isEmpty() && !keep.isEmpty()) {
            StringBuilder sql = new StringBuilder("delete from units where floor_id in (");
            Map<String, Object> params = new HashMap<>();
            int i = 0;
            for (String fid : floorIds) {
                if (i > 0) sql.append(',');
                String key = "f" + i;
                sql.append(':').append(key);
                params.put(key, fid);
                i++;
            }
            sql.append(") and id not in (");
            int j = 0;
            for (String id : keep) {
                if (j > 0) sql.append(',');
                String key = "k" + j;
                sql.append(':').append(key);
                params.put(key, id);
                j++;
            }
            sql.append(')');
            execute(sql.toString(), params);
        }
        return Map.of("ok", true, "count", keep.size());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> explication(String unitId) {
        return queryList("select * from rooms where unit_id = :unitId order by created_at asc", Map.of("unitId", unitId));
    }

    @Transactional
    public Map<String, Object> syncParkingPlaces(String floorId, List<Map<String, Object>> places) {
        execute("delete from units where floor_id = :floorId and unit_type = 'parking'", Map.of("floorId", floorId));
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

    @Transactional(readOnly = true)
    public List<Map<String, Object>> commonAreas(String blockId) {
        return queryList("select * from common_areas where block_id = :blockId order by created_at asc", Map.of("blockId", blockId));
    }

    @Transactional
    public Map<String, Object> upsertCommonArea(Map<String, Object> body) {
        String id = stringValOr(body.get("id"), UUID.randomUUID().toString());
        execute("""
            insert into common_areas(id, block_id, floor_id, area_type, area, count, updated_at)
            values (:id,:blockId,:floorId,:type,:area,:count,now())
            on conflict (id) do update set
                block_id=excluded.block_id, floor_id=excluded.floor_id, area_type=excluded.area_type,
                area=excluded.area, count=excluded.count, updated_at=now()
            """, Map.of(
            "id", id,
            "blockId", body.get("blockId"),
            "floorId", body.get("floorId"),
            "type", body.get("type"),
            "area", body.get("area"),
            "count", body.get("count")
        ));
        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> deleteCommonArea(String id) {
        execute("delete from common_areas where id = :id", Map.of("id", id));
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> clearCommonAreas(String blockId) {
        execute("delete from common_areas where block_id = :blockId", Map.of("blockId", blockId));
        return Map.of("ok", true);
    }

    @Transactional
    public Map<String, Object> reconcileCommonAreas(String blockId, List<Map<String, Object>> items) {
        Set<String> keep = new LinkedHashSet<>();
        for (Map<String, Object> item : items) {
            Map<String, Object> payload = new HashMap<>(item);
            payload.put("blockId", blockId);
            String id = String.valueOf(upsertCommonArea(payload).get("id"));
            keep.add(id);
        }
        if (!keep.isEmpty()) {
            StringBuilder sql = new StringBuilder("delete from common_areas where block_id = :blockId and id not in (");
            Map<String, Object> params = new HashMap<>();
            params.put("blockId", blockId);
            int i = 0;
            for (String id : keep) {
                if (i > 0) sql.append(',');
                String key = "id" + i;
                sql.append(':').append(key);
                params.put(key, id);
                i++;
            }
            sql.append(')');
            execute(sql.toString(), params);
        }
        return Map.of("ok", true, "count", keep.size());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listExtensions(String blockId) {
        return queryList("""
            select * from block_extensions
            where parent_block_id = :blockId
            order by created_at asc
            """, Map.of("blockId", blockId));
    }

    @Transactional
    public Map<String, Object> createExtension(String blockId, Map<String, Object> body) {
        Map<String, Object> extensionData = mapFrom(body == null ? null : body.get("extensionData"));
        Map<String, Object> normalized = normalizeExtensionPayload(extensionData);
        String id = UUID.randomUUID().toString();

        List<Map<String, Object>> blockRows = queryList("select building_id from building_blocks where id = :blockId", Map.of("blockId", blockId));
        if (blockRows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Block not found");

        Map<String, Object> createParams = new HashMap<>();
        createParams.put("id", id);
        createParams.put("buildingId", blockRows.get(0).get("building_id"));
        createParams.put("blockId", blockId);
        createParams.put("label", normalized.get("label"));
        createParams.put("extensionType", normalized.get("extension_type"));
        createParams.put("constructionKind", normalized.get("construction_kind"));
        createParams.put("floorsCount", normalized.get("floors_count"));
        createParams.put("startFloorIndex", normalized.get("start_floor_index"));
        createParams.put("verticalAnchorType", normalized.get("vertical_anchor_type"));
        createParams.put("anchorFloorKey", normalized.get("anchor_floor_key"));
        createParams.put("notes", normalized.get("notes"));

        execute("""
            insert into block_extensions (id, building_id, parent_block_id, label, extension_type, construction_kind, floors_count, start_floor_index, vertical_anchor_type, anchor_floor_key, notes, updated_at)
            values (:id, :buildingId, :blockId, :label, :extensionType, :constructionKind, :floorsCount, :startFloorIndex, :verticalAnchorType, :anchorFloorKey, :notes, now())
            """, createParams);

        List<Map<String, Object>> created = queryList("select * from block_extensions where id = :id", Map.of("id", id));
        if (created.isEmpty()) throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to read created extension");
        syncExtensionFloors(id);
        return created.get(0);
    }

    @Transactional
    public Map<String, Object> updateExtension(String extensionId, Map<String, Object> body) {
        Map<String, Object> extensionData = mapFrom(body == null ? null : body.get("extensionData"));
        Map<String, Object> normalized = normalizeExtensionPayload(extensionData);

        int count = execute("""
            update block_extensions
            set label = :label,
                extension_type = :extensionType,
                construction_kind = :constructionKind,
                floors_count = :floorsCount,
                start_floor_index = :startFloorIndex,
                vertical_anchor_type = :verticalAnchorType,
                anchor_floor_key = :anchorFloorKey,
                notes = :notes,
                updated_at = now()
            where id = :extensionId
            """, Map.of(
            "extensionId", extensionId,
            "label", normalized.get("label"),
            "extensionType", normalized.get("extension_type"),
            "constructionKind", normalized.get("construction_kind"),
            "floorsCount", normalized.get("floors_count"),
            "startFloorIndex", normalized.get("start_floor_index"),
            "verticalAnchorType", normalized.get("vertical_anchor_type"),
            "anchorFloorKey", normalized.get("anchor_floor_key"),
            "notes", normalized.get("notes")
        ));

        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Extension not found");
        List<Map<String, Object>> updated = queryList("select * from block_extensions where id = :id", Map.of("id", extensionId));
        if (updated.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Extension not found");
        syncExtensionFloors(extensionId);
        return updated.get(0);
    }

    @Transactional
    public Map<String, Object> deleteExtension(String extensionId) {
        int count = execute("delete from block_extensions where id = :extensionId", Map.of("extensionId", extensionId));
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Extension not found");
        return Map.of("ok", true, "id", extensionId);
    }

    private void syncExtensionFloors(String extensionId) {
        Map<String, Object> extension = queryList(
            "select id, parent_block_id, floors_count, start_floor_index from block_extensions where id = :id",
            Map.of("id", extensionId)
        ).stream().findFirst().orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Extension not found"));

        int floorsCount = Math.max(1, toInt(extension.get("floors_count")));
        int startFloorIndex = Math.max(1, toInt(extension.get("start_floor_index")));

        List<Map<String, Object>> existing = queryList("select id, index from floors where extension_id = :extensionId", Map.of("extensionId", extensionId));
        Map<Integer, String> existingByIndex = new HashMap<>();
        for (Map<String, Object> row : existing) {
            existingByIndex.put(toInt(row.get("index")), stringValOr(row.get("id"), ""));
        }

        Set<Integer> target = new HashSet<>();
        for (int i = 0; i < floorsCount; i++) {
            int idx = startFloorIndex + i;
            target.add(idx);
            String floorId = existingByIndex.getOrDefault(idx, UUID.randomUUID().toString());

            execute("""
                insert into floors(id, block_id, extension_id, index, floor_key, label, floor_type, parent_floor_index, basement_id, updated_at)
                values (:id, null, :extensionId, :idx, :floorKey, :label, :floorType, null, null, now())
                on conflict (id) do update
                set block_id = excluded.block_id,
                    extension_id = excluded.extension_id,
                    index = excluded.index,
                    floor_key = excluded.floor_key,
                    label = excluded.label,
                    floor_type = excluded.floor_type,
                    parent_floor_index = excluded.parent_floor_index,
                    basement_id = excluded.basement_id,
                    updated_at = now()
                """, Map.of(
                "id", floorId,
                "extensionId", extensionId,
                "idx", idx,
                "floorKey", "extension:" + extensionId + ":" + idx,
                "label", idx + " этаж",
                "floorType", "residential"
            ));
        }

        for (Map<String, Object> row : existing) {
            int idx = toInt(row.get("index"));
            if (target.contains(idx)) continue;
            execute("delete from floors where id = :id", Map.of("id", row.get("id")));
        }
    }

    private List<Map<String, Object>> queryList(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql, Tuple.class);
        params.forEach(query::setParameter);
        @SuppressWarnings("unchecked")
        List<Tuple> tuples = query.getResultList();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Tuple tuple : tuples) rows.add(tupleToMap(tuple));
        return rows;
    }

    private int execute(String sql, Map<String, Object> params) {
        Query query = em.createNativeQuery(sql);
        params.forEach(query::setParameter);
        return query.executeUpdate();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> mapFrom(Object value) {
        if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
        return Map.of();
    }

    private Map<String, Object> tupleToMap(Tuple tuple) {
        Map<String, Object> row = new LinkedHashMap<>();
        tuple.getElements().forEach(e -> row.put(e.getAlias(), tuple.get(e)));
        return row;
    }



    private Map<String, Object> validateMatrixValues(Map<String, Object> values) {
        boolean hasAny = values.containsKey("apts") || values.containsKey("units") || values.containsKey("mopQty");
        if (!hasAny) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "values must include at least one field: apts, units, mopQty");
        }

        int maxAllowed = 500;
        Map<String, Object> payload = new HashMap<>();
        if (values.containsKey("apts")) {
            Integer parsed = parseOptionalNonNegativeInt(values.get("apts"));
            if (parsed != null && parsed > maxAllowed) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "apts must be <= " + maxAllowed);
            payload.put("flats_count", parsed);
        }
        if (values.containsKey("units")) {
            Integer parsed = parseOptionalNonNegativeInt(values.get("units"));
            if (parsed != null && parsed > maxAllowed) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "units must be <= " + maxAllowed);
            payload.put("commercial_count", parsed);
        }
        if (values.containsKey("mopQty")) {
            Integer parsed = parseOptionalNonNegativeInt(values.get("mopQty"));
            if (parsed != null && parsed > maxAllowed) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "mopQty must be <= " + maxAllowed);
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
            if (parsed < 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "value must be non-negative integer");
            return parsed;
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "value must be non-negative integer");
        }
    }

    private String namedInClause(String prefix, int size) {
        List<String> names = new ArrayList<>();
        for (int i = 0; i < size; i++) names.add(":" + prefix + i);
        return String.join(",", names);
    }

    private Map<String, Object> mapForInClause(String prefix, List<String> values) {
        Map<String, Object> params = new HashMap<>();
        for (int i = 0; i < values.size(); i++) params.put(prefix + i, values.get(i));
        return params;
    }

    private int toInt(Object value) {
        if (value == null) return 0;
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (NumberFormatException e) { return 0; }
    }

    private String stringValOr(Object value, String fallback) {
        if (value == null) return fallback;
        String v = String.valueOf(value);
        return v.isBlank() ? fallback : v;
    }
}
