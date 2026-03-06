package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ParkingSyncService {

    private final JdbcTemplate jdbcTemplate;

    public ParkingSyncService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public ParkingSyncResult syncParkingPlaces(UUID floorId, int targetCount) {
        int normalizedTargetCount = Math.max(0, targetCount);
        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "select id, number from units where floor_id=? and unit_type='parking_place'",
            floorId
        );

        int current = existing.size();
        int removed = 0;
        int added = 0;

        if (current == normalizedTargetCount) {
            return new ParkingSyncResult(added, removed);
        }

        if (current < normalizedTargetCount) {
            for (int i = 0; i < (normalizedTargetCount - current); i++) {
                added += jdbcTemplate.update(
                    "insert into units(id,floor_id,number,unit_type,total_area,status,created_at,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,?)",
                    floorId,
                    null,
                    "parking_place",
                    null,
                    "free",
                    Instant.now(),
                    Instant.now()
                );
            }
            return new ParkingSyncResult(added, removed);
        }

        List<Map<String, Object>> sorted = new ArrayList<>(existing);
        sorted.sort((left, right) -> Integer.compare(toInt(right.get("number"), 0), toInt(left.get("number"), 0)));
        List<Map<String, Object>> toDelete = sorted.subList(0, current - normalizedTargetCount);
        for (Map<String, Object> row : toDelete) {
            removed += jdbcTemplate.update("delete from units where id = ?", UUID.fromString(String.valueOf(row.get("id"))));
        }

        return new ParkingSyncResult(added, removed);
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

    public record ParkingSyncResult(int added, int removed) {
    }
}
