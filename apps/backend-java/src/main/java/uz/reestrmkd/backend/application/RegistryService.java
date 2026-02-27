package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class RegistryService {
    private final JdbcTemplate jdbc;

    public RegistryService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<Map<String, Object>> floors(String blockId) {
        return jdbc.queryForList("select * from floors where block_id = ? order by floor_number asc", blockId);
    }

    @Transactional
    public Map<String, Object> updateFloor(String floorId, Map<String, Object> body) {
        jdbc.update("update floors set floor_number=?, floor_type=?, updated_at=now() where id=?",
            body.get("floorNumber"), body.get("floorType"), floorId);
        return Map.of("ok", true);
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

    public Map<String, Object> entranceMatrix(String blockId) {
        var floors = floors(blockId);
        var entrances = entrances(blockId);
        var units = units(blockId);
        return Map.of("floors", floors, "entrances", entrances, "units", units.get("units"));
    }

    @Transactional
    public Map<String, Object> updateEntranceMatrixCell(String blockId, Map<String, Object> body) {
        Object unitId = body.get("unitId");
        Object entranceId = body.get("entranceId");
        if (unitId == null) return Map.of("ok", false, "message", "unitId is required");
        jdbc.update("update units set entrance_id = ?, updated_at=now() where id = ?", entranceId, unitId);
        return Map.of("ok", true);
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
            id, body.get("floorId"), body.get("entranceId"), body.get("unitCode"), body.get("number"), body.get("type"), body.get("area"), body.get("livingArea"), body.get("usefulArea"), body.get("rooms"), body.get("hasMezzanine"), body.get("mezzanineType"), body.get("status"));
        return Map.of("id", id);
    }

    @Transactional
    public Map<String, Object> batchUpsertUnits(List<Map<String, Object>> units) {
        List<Map<String, Object>> saved = new ArrayList<>();
        for (Map<String, Object> unit : units) saved.add(upsertUnit(unit));
        return Map.of("ok", true, "items", saved);
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
