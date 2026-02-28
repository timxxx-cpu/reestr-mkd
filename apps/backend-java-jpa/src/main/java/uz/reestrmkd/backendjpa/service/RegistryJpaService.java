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
    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public List<Map<String, Object>> floors(String blockId) {
        return queryList("select * from floors where block_id = :blockId order by floor_number asc", Map.of("blockId", blockId));
    }

    @Transactional
    public Map<String, Object> updateFloor(String floorId, Map<String, Object> body) {
        execute("""
            update floors set floor_number=:floorNumber, floor_type=:floorType, updated_at=now() where id=:id
            """, Map.of("floorNumber", body.get("floorNumber"), "floorType", body.get("floorType"), "id", floorId));
        return Map.of("ok", true);
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
        return queryList("select * from entrance_matrix where block_id = :blockId order by floor_id asc, entrance_id asc", Map.of("blockId", blockId));
    }

    @Transactional
    public Map<String, Object> upsertMatrixCell(String blockId, Map<String, Object> body) {
        execute("""
            insert into entrance_matrix(id, block_id, floor_id, entrance_id, unit_count, updated_at)
            values (:id,:blockId,:floorId,:entranceId,:unitCount,now())
            on conflict (id) do update set unit_count=excluded.unit_count, updated_at=now()
            """, Map.of(
            "id", stringValOr(body.get("id"), UUID.randomUUID().toString()),
            "blockId", blockId,
            "floorId", body.get("floorId"),
            "entranceId", body.get("entranceId"),
            "unitCount", body.get("unitCount")
        ));
        return Map.of("ok", true);
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
        params.put("number", body.get("number"));
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
        String id = UUID.randomUUID().toString();

        List<Map<String, Object>> blockRows = queryList("select building_id from building_blocks where id = :blockId", Map.of("blockId", blockId));
        if (blockRows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Block not found");

        execute("""
            insert into block_extensions (id, building_id, parent_block_id, extension_number, entrance_number, floors_count, units_count, updated_at)
            values (:id, :buildingId, :blockId, :extensionNumber, :entranceNumber, :floorsCount, :unitsCount, now())
            """, Map.of(
            "id", id,
            "buildingId", blockRows.get(0).get("building_id"),
            "blockId", blockId,
            "extensionNumber", toInt(extensionData.get("extensionNumber")),
            "entranceNumber", toInt(extensionData.get("entranceNumber")),
            "floorsCount", toInt(extensionData.get("floorsCount")),
            "unitsCount", toInt(extensionData.get("unitsCount"))
        ));

        return Map.of("ok", true, "id", id);
    }

    @Transactional
    public Map<String, Object> updateExtension(String extensionId, Map<String, Object> body) {
        Map<String, Object> extensionData = mapFrom(body == null ? null : body.get("extensionData"));

        int count = execute("""
            update block_extensions
            set extension_number = :extensionNumber,
                entrance_number = :entranceNumber,
                floors_count = :floorsCount,
                units_count = :unitsCount,
                updated_at = now()
            where id = :extensionId
            """, Map.of(
            "extensionId", extensionId,
            "extensionNumber", toInt(extensionData.get("extensionNumber")),
            "entranceNumber", toInt(extensionData.get("entranceNumber")),
            "floorsCount", toInt(extensionData.get("floorsCount")),
            "unitsCount", toInt(extensionData.get("unitsCount"))
        ));

        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Extension not found");
        return Map.of("ok", true, "id", extensionId);
    }

    @Transactional
    public Map<String, Object> deleteExtension(String extensionId) {
        int count = execute("delete from block_extensions where id = :extensionId", Map.of("extensionId", extensionId));
        if (count == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Extension not found");
        return Map.of("ok", true, "id", extensionId);
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
