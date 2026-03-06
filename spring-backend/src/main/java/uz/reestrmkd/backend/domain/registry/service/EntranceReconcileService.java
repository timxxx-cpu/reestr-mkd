package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EntranceReconcileService {

    private final JdbcTemplate jdbcTemplate;

    public EntranceReconcileService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public EntranceReconcileResult reconcile(UUID blockId, int count) {
        int normalizedCount = Math.max(0, count);

        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "select id, number from entrances where block_id=? order by number",
            blockId
        );
        Set<Integer> present = existing.stream()
            .map(x -> ((Number) x.get("number")).intValue())
            .collect(Collectors.toSet());

        int created = 0;
        for (int i = 1; i <= normalizedCount; i++) {
            if (!present.contains(i)) {
                jdbcTemplate.update(
                    "insert into entrances(id,block_id,number,created_at,updated_at) values (gen_random_uuid(),?,?,now(),now())",
                    blockId,
                    i
                );
                created += 1;
            }
        }

        List<UUID> deleteIds = existing.stream()
            .filter(row -> ((Number) row.get("number")).intValue() > normalizedCount)
            .map(row -> UUID.fromString(String.valueOf(row.get("id"))))
            .toList();

        if (!deleteIds.isEmpty()) {
            String in = String.join(",", Collections.nCopies(deleteIds.size(), "?"));
            jdbcTemplate.update("delete from entrances where id in (" + in + ")", deleteIds.toArray());
        }

        return new EntranceReconcileResult(normalizedCount, created, deleteIds.size());
    }

    public record EntranceReconcileResult(int count, int created, int deleted) {
    }
}
