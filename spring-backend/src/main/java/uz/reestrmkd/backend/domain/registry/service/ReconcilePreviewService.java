package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class ReconcilePreviewService {

    private final JdbcTemplate jdbcTemplate;

    public ReconcilePreviewService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> preview(UUID blockId) {
        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<UUID> floorIds = floors.stream().map(row -> UUID.fromString(String.valueOf(row.get("id")))).toList();
        if (floorIds.isEmpty()) {
            return Map.of(
                "units", Map.of("toRemove", 0, "checkedCells", 0),
                "commonAreas", Map.of("toRemove", 0, "checkedCells", 0)
            );
        }

        Map<Integer, UUID> entranceByNumber = loadEntranceMap(blockId);
        Map<String, Map<String, Integer>> desiredUnitsMap = new HashMap<>();
        Map<String, Integer> desiredMopsMap = new HashMap<>();
        List<Map<String, Object>> matrixRows = jdbcTemplate.queryForList(
            "select floor_id, entrance_number, flats_count, commercial_count, mop_count from entrance_matrix where block_id=?",
            blockId
        );
        for (Map<String, Object> row : matrixRows) {
            UUID entranceId = entranceByNumber.get(toNullableInt(row.get("entrance_number")));
            if (entranceId == null) continue;
            String key = row.get("floor_id") + "_" + entranceId;
            desiredUnitsMap.put(key, Map.of(
                "flats", Math.max(0, toInt(row.get("flats_count"), 0)),
                "commercial", Math.max(0, toInt(row.get("commercial_count"), 0))
            ));
            desiredMopsMap.put(key, Math.max(0, toInt(row.get("mop_count"), 0)));
        }

        String inFloors = String.join(",", Collections.nCopies(floorIds.size(), "?"));
        List<Map<String, Object>> units = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_id, unit_type, created_at from units where floor_id in (" + inFloors + ")",
            floorIds.toArray()
        );
        List<Map<String, Object>> areas = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_id, created_at from common_areas where floor_id in (" + inFloors + ")",
            floorIds.toArray()
        );

        Map<String, Integer> flatsByKey = new HashMap<>();
        Map<String, Integer> commercialByKey = new HashMap<>();
        for (Map<String, Object> unit : units) {
            String type = String.valueOf(unit.get("unit_type"));
            String key = unit.get("floor_id") + "_" + unit.get("entrance_id");
            if (isFlatType(type)) flatsByKey.put(key, flatsByKey.getOrDefault(key, 0) + 1);
            else if (isCommercialType(type)) commercialByKey.put(key, commercialByKey.getOrDefault(key, 0) + 1);
        }

        Set<String> unitKeys = new HashSet<>();
        unitKeys.addAll(flatsByKey.keySet());
        unitKeys.addAll(commercialByKey.keySet());
        int unitsToRemove = 0;
        for (String key : unitKeys) {
            Map<String, Integer> desired = desiredUnitsMap.getOrDefault(key, Map.of("flats", 0, "commercial", 0));
            unitsToRemove += Math.max(0, flatsByKey.getOrDefault(key, 0) - desired.get("flats"));
            unitsToRemove += Math.max(0, commercialByKey.getOrDefault(key, 0) - desired.get("commercial"));
        }

        Map<String, Integer> mopsByKey = new HashMap<>();
        for (Map<String, Object> area : areas) {
            String key = area.get("floor_id") + "_" + area.get("entrance_id");
            mopsByKey.put(key, mopsByKey.getOrDefault(key, 0) + 1);
        }
        int mopsToRemove = 0;
        for (Map.Entry<String, Integer> entry : mopsByKey.entrySet()) {
            mopsToRemove += Math.max(0, entry.getValue() - desiredMopsMap.getOrDefault(entry.getKey(), 0));
        }

        return Map.of(
            "units", Map.of("toRemove", unitsToRemove, "checkedCells", unitKeys.size()),
            "commonAreas", Map.of("toRemove", mopsToRemove, "checkedCells", mopsByKey.size())
        );
    }

    private Map<Integer, UUID> loadEntranceMap(UUID blockId) {
        List<Map<String, Object>> entrances = jdbcTemplate.queryForList("select id, number from entrances where block_id=?", blockId);
        Map<Integer, UUID> entranceByNumber = new HashMap<>();
        for (Map<String, Object> entrance : entrances) {
            entranceByNumber.put(toInt(entrance.get("number"), 0), UUID.fromString(String.valueOf(entrance.get("id"))));
        }
        return entranceByNumber;
    }

    private int toInt(Object value, Integer fallback) {
        if (value == null) return fallback;
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (Exception ex) { return fallback; }
    }

    private Integer toNullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        try { return Integer.parseInt(String.valueOf(value)); } catch (Exception ex) { return null; }
    }

    private boolean isFlatType(String type) {
        return "flat".equalsIgnoreCase(type) || "apartment".equalsIgnoreCase(type);
    }

    private boolean isCommercialType(String type) {
        return "office".equalsIgnoreCase(type) || "commercial".equalsIgnoreCase(type);
    }
}
