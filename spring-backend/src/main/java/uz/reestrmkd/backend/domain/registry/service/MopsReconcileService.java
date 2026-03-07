package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MopsReconcileService {

    private final JdbcTemplate jdbcTemplate;

    public MopsReconcileService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public MopsReconcileResult reconcile(UUID blockId) {
        int removed = 0;
        int checkedCells = 0;

        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<UUID> floorIds = floors.stream().map(row -> UUID.fromString(String.valueOf(row.get("id")))).toList();
        if (floorIds.isEmpty()) {
            return new MopsReconcileResult(removed, checkedCells);
        }

        Map<Integer, UUID> entranceByNumber = loadEntranceMap(blockId);
        Map<String, Integer> desiredMap = new HashMap<>();
        List<Map<String, Object>> matrixRows = jdbcTemplate.queryForList(
            "select floor_id, entrance_number, mop_count from entrance_matrix where block_id=?",
            blockId
        );
        for (Map<String, Object> row : matrixRows) {
            Integer entranceNumber = toNullableInt(row.get("entrance_number"));
            UUID entranceId;
            if (entranceNumber == null) {
                continue;
            } else if (entranceNumber == 0) {
                entranceId = null;
            } else {
                entranceId = entranceByNumber.get(entranceNumber);
                if (entranceId == null) continue;
            }
            desiredMap.put(row.get("floor_id") + "_" + entranceId, Math.max(0, toInt(row.get("mop_count"), 0)));
        }

        String inFloors = String.join(",", Collections.nCopies(floorIds.size(), "?"));
        List<Map<String, Object>> areas = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_id, created_at from common_areas where floor_id in (" + inFloors + ")",
            floorIds.toArray()
        );

        Map<String, List<Map<String, Object>>> grouped = new HashMap<>();
        for (Map<String, Object> area : areas) {
            String key = area.get("floor_id") + "_" + area.get("entrance_id");
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(area);
        }

        List<UUID> toDelete = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : grouped.entrySet()) {
            checkedCells++;
            int desired = desiredMap.getOrDefault(entry.getKey(), 0);
            List<Map<String, Object>> sorted = new ArrayList<>(entry.getValue());
            sorted.sort(Comparator.comparing(r -> toInstant(r.get("created_at"))));
            if (sorted.size() > desired) {
                sorted.subList(desired, sorted.size())
                    .forEach(row -> toDelete.add(UUID.fromString(String.valueOf(row.get("id")))));
            }
        }

        if (!toDelete.isEmpty()) {
            String inIds = String.join(",", Collections.nCopies(toDelete.size(), "?"));
            removed = jdbcTemplate.update("delete from common_areas where id in (" + inIds + ")", toDelete.toArray());
        }

        return new MopsReconcileResult(removed, checkedCells);
    }

    private Map<Integer, UUID> loadEntranceMap(UUID blockId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("select id, number from entrances where block_id=?", blockId);
        return rows.stream().collect(Collectors.toMap(
            row -> ((Number) row.get("number")).intValue(),
            row -> UUID.fromString(String.valueOf(row.get("id"))),
            (v1, v2) -> v1
        ));
    }

    private int toInt(Object value, Integer fallback) {
        if (value == null) return fallback;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            return fallback;
        }
    }

    private Integer toNullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            return null;
        }
    }

    private Instant toInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value == null) return Instant.EPOCH;
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception ex) {
            return Instant.EPOCH;
        }
    }

    public record MopsReconcileResult(int removed, int checkedCells) {
    }
}
