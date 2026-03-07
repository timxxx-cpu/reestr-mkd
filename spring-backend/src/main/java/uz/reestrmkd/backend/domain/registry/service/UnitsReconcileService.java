package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UnitsReconcileService {

    private final JdbcTemplate jdbcTemplate;

    public UnitsReconcileService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public UnitsReconcileResult reconcile(UUID blockId) {
        int removed = 0;
        int added = 0;
        int checkedCells = 0;

        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<UUID> floorIds = floors.stream().map(row -> UUID.fromString(String.valueOf(row.get("id")))).toList();
        if (floorIds.isEmpty()) {
            return new UnitsReconcileResult(removed, added, checkedCells);
        }

        Map<Integer, UUID> entranceByNumber = loadEntranceMap(blockId);
        Map<String, Map<String, Integer>> desiredMap = new HashMap<>();

        List<Map<String, Object>> matrixRows = jdbcTemplate.queryForList(
            "select floor_id, entrance_number, flats_count, commercial_count from entrance_matrix where block_id=?",
            blockId
        );
        for (Map<String, Object> row : matrixRows) {
            Integer entranceNumber = toNullableInt(row.get("entrance_number"));
            UUID entranceId = entranceByNumber.get(entranceNumber);
            if (entranceId == null) continue;
            String key = row.get("floor_id") + "_" + entranceId;
            desiredMap.put(key, Map.of(
                "flats", Math.max(0, toInt(row.get("flats_count"), 0)),
                "commercial", Math.max(0, toInt(row.get("commercial_count"), 0))
            ));
        }

        String inFloors = String.join(",", Collections.nCopies(floorIds.size(), "?"));
        List<Map<String, Object>> units = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_id, unit_type, cadastre_number, total_area, useful_area, living_area, created_at from units where floor_id in (" + inFloors + ")",
            floorIds.toArray()
        );

        Map<String, List<Map<String, Object>>> flatsGrouped = new HashMap<>();
        Map<String, List<Map<String, Object>>> commGrouped = new HashMap<>();
        for (Map<String, Object> unit : units) {
            String type = String.valueOf(unit.get("unit_type"));
            String key = unit.get("floor_id") + "_" + unit.get("entrance_id");
            if (isFlatType(type)) flatsGrouped.computeIfAbsent(key, k -> new ArrayList<>()).add(unit);
            else if (isCommercialType(type)) commGrouped.computeIfAbsent(key, k -> new ArrayList<>()).add(unit);
        }

        Set<String> keys = new HashSet<>(desiredMap.keySet());
        keys.addAll(flatsGrouped.keySet());
        keys.addAll(commGrouped.keySet());

        List<UUID> toDelete = new ArrayList<>();

        for (String key : keys) {
            checkedCells++;
            Map<String, Integer> desired = desiredMap.getOrDefault(key, Map.of("flats", 0, "commercial", 0));
            List<Map<String, Object>> flats = new ArrayList<>(flatsGrouped.getOrDefault(key, List.of()));
            List<Map<String, Object>> comm = new ArrayList<>(commGrouped.getOrDefault(key, List.of()));

            Comparator<Map<String, Object>> preserveRichDataComparator = Comparator
                .comparing((Map<String, Object> row) -> hasCadastreNumber(row) ? 0 : 1)
                .thenComparing(row -> hasAreaData(row) ? 0 : 1)
                .thenComparing(row -> toInstant(row.get("created_at")));
            flats.sort(preserveRichDataComparator);
            comm.sort(preserveRichDataComparator);

            int desiredFlats = desired.get("flats");
            if (flats.size() > desiredFlats) {
                flats.subList(desiredFlats, flats.size())
                    .forEach(row -> toDelete.add(UUID.fromString(String.valueOf(row.get("id")))));
            }

            int desiredComm = desired.get("commercial");
            if (comm.size() > desiredComm) {
                comm.subList(desiredComm, comm.size())
                    .forEach(row -> toDelete.add(UUID.fromString(String.valueOf(row.get("id")))));
            }
        }

        if (!toDelete.isEmpty()) {
            String inIds = String.join(",", Collections.nCopies(toDelete.size(), "?"));
            removed = jdbcTemplate.update("delete from units where id in (" + inIds + ")", toDelete.toArray());
        }

        return new UnitsReconcileResult(removed, added, checkedCells);
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

    private boolean isFlatType(String type) {
        return "flat".equalsIgnoreCase(type) || "apartment".equalsIgnoreCase(type);
    }

    private boolean isCommercialType(String type) {
        return "office".equalsIgnoreCase(type) || "commercial".equalsIgnoreCase(type);
    }

    private boolean hasCadastreNumber(Map<String, Object> row) {
        Object value = row.get("cadastre_number");
        return value != null && !String.valueOf(value).isBlank();
    }

    private boolean hasAreaData(Map<String, Object> row) {
        return row.get("total_area") != null || row.get("useful_area") != null || row.get("living_area") != null;
    }

    public record UnitsReconcileResult(int removed, int added, int checkedCells) {
    }
}
