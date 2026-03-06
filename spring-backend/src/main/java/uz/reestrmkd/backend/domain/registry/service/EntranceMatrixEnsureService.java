package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class EntranceMatrixEnsureService {
    private final JdbcTemplate jdbcTemplate;

    public EntranceMatrixEnsureService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void ensureForBlock(UUID blockId) {
        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<Map<String, Object>> entrances = jdbcTemplate.queryForList("select number from entrances where block_id=?", blockId);

        List<UUID> floorIds = floors.stream().map(row -> UUID.fromString(String.valueOf(row.get("id")))).toList();
        List<Integer> entranceNumbers = entrances.stream().map(row -> toInt(row.get("number"), -1)).filter(n -> n > 0).toList();

        if (floorIds.isEmpty() || entranceNumbers.isEmpty()) {
            jdbcTemplate.update("delete from entrance_matrix where block_id=?", blockId);
            return;
        }

        List<Map<String, Object>> existingRows = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_number from entrance_matrix where block_id=?",
            blockId
        );

        Set<UUID> floorSet = new HashSet<>(floorIds);
        Set<Integer> entranceSet = new HashSet<>(entranceNumbers);
        Set<String> existingKeys = new HashSet<>();
        List<UUID> staleIds = new ArrayList<>();

        for (Map<String, Object> row : existingRows) {
            UUID floorId = UUID.fromString(String.valueOf(row.get("floor_id")));
            int entranceNumber = toInt(row.get("entrance_number"), 0);
            if (!floorSet.contains(floorId) || !entranceSet.contains(entranceNumber)) {
                staleIds.add(UUID.fromString(String.valueOf(row.get("id"))));
                continue;
            }
            existingKeys.add(floorId + "|" + entranceNumber);
        }

        if (!staleIds.isEmpty()) {
            String in = String.join(",", Collections.nCopies(staleIds.size(), "?"));
            jdbcTemplate.update("delete from entrance_matrix where id in (" + in + ")", staleIds.toArray());
        }

        for (UUID floorId : floorIds) {
            for (Integer entranceNumber : entranceNumbers) {
                String key = floorId + "|" + entranceNumber;
                if (existingKeys.contains(key)) continue;
                jdbcTemplate.update(
                    "insert into entrance_matrix(id, block_id, floor_id, entrance_number, updated_at) values (gen_random_uuid(),?,?,?,?,now()) on conflict (block_id,floor_id,entrance_number) do nothing",
                    blockId,
                    floorId,
                    entranceNumber
                );
            }
        }
    }

    private int toInt(Object value, Integer fallback) {
        if (value == null) return fallback;
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ex) {
            return fallback;
        }
    }
}

