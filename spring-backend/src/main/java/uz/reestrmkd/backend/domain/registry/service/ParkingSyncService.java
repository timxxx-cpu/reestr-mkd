package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.common.service.UjIdentifierService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class ParkingSyncService {

    private final JdbcTemplate jdbcTemplate;
    private final UjIdentifierService ujIdentifierService;

    public ParkingSyncService(JdbcTemplate jdbcTemplate, UjIdentifierService ujIdentifierService) {
        this.jdbcTemplate = jdbcTemplate;
        this.ujIdentifierService = ujIdentifierService;
    }

    public ParkingSyncResult syncParkingPlaces(UUID floorId, int targetCount) {
        int normalizedTargetCount = Math.max(0, targetCount);
        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "select id, number, unit_code from units where floor_id=? and unit_type='parking_place' order by created_at asc, id asc",
            floorId
        );
        List<Map<String, Object>> missingCodes = existing.stream()
            .filter(row -> isBlank(asNullableString(row.get("unit_code"))))
            .toList();

        int current = existing.size();
        int removed = 0;
        int added = 0;
        ParkingCodeContext codeContext = null;

        if (current < normalizedTargetCount || !missingCodes.isEmpty()) {
            codeContext = loadParkingCodeContext(floorId);
            backfillMissingParkingCodes(missingCodes, codeContext);
        }

        if (current == normalizedTargetCount) {
            return new ParkingSyncResult(added, removed);
        }

        if (current < normalizedTargetCount) {
            for (int i = 0; i < (normalizedTargetCount - current); i++) {
                added += jdbcTemplate.update(
                    "insert into units(id,floor_id,number,unit_type,total_area,status,has_mezzanine,unit_code,created_at,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,?,now(),now())",
                    floorId,
                    null,
                    "parking_place",
                    null,
                    "free",
                    false,
                    Objects.requireNonNull(codeContext).nextCode(ujIdentifierService)
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

    private void backfillMissingParkingCodes(List<Map<String, Object>> rows, ParkingCodeContext codeContext) {
        for (Map<String, Object> row : rows) {
            UUID unitId = toUuid(row.get("id"));
            String code = codeContext.nextCode(ujIdentifierService);
            jdbcTemplate.update(
                "update units set unit_code=?, updated_at=now() where id=?",
                code,
                unitId
            );
        }
    }

    private ParkingCodeContext loadParkingCodeContext(UUID floorId) {
        List<Map<String, Object>> contextRows = jdbcTemplate.queryForList(
            """
                select bb.building_id, b.building_code, p.uj_code
                from floors f
                join building_blocks bb on bb.id=f.block_id
                join buildings b on b.id=bb.building_id
                join projects p on p.id=b.project_id
                where f.id=?
            """,
            floorId
        );

        if (contextRows.isEmpty()) {
            throw new ApiException("Floor not found", "NOT_FOUND", null, 404);
        }

        Map<String, Object> row = contextRows.getFirst();
        UUID buildingId = toUuid(row.get("building_id"));
        String buildingCode = asNullableString(row.get("building_code"));
        String ujCode = asNullableString(row.get("uj_code"));

        String basePrefix = ujIdentifierService.getUnitPrefix("parking_place");
        String fullPrefix = buildFullUnitPrefix(ujCode, buildingCode, basePrefix);

        List<String> existingCodes = jdbcTemplate.queryForList(
            "select u.unit_code from units u join floors f on f.id=u.floor_id join building_blocks bb on bb.id=f.block_id where bb.building_id=? and u.unit_code is not null",
            String.class,
            buildingId
        );

        int nextSequence = ujIdentifierService.getNextSequenceNumber(
            existingCodes == null ? Collections.emptyList() : existingCodes,
            fullPrefix
        );

        return new ParkingCodeContext(fullPrefix, nextSequence);
    }

    private String buildFullUnitPrefix(String ujCode, String buildingCode, String unitPrefix) {
        if (!isBlank(buildingCode)) {
            if (!isBlank(ujCode) && buildingCode.startsWith(ujCode)) {
                return buildingCode + "-" + unitPrefix;
            }
            return (isBlank(ujCode) ? "" : ujCode + "-") + buildingCode + "-" + unitPrefix;
        }
        return (isBlank(ujCode) ? "" : ujCode + "-") + unitPrefix;
    }

    private UUID toUuid(Object value) {
        if (value instanceof UUID uuid) return uuid;
        if (value == null) {
            throw new ApiException("UUID value is required", "VALIDATION_ERROR", null, 400);
        }
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException ex) {
            throw new ApiException("Invalid UUID: " + value, "VALIDATION_ERROR", null, 400);
        }
    }

    private String asNullableString(Object value) {
        if (value == null) return null;
        String raw = String.valueOf(value).trim();
        return raw.isBlank() ? null : raw;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
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

    private static final class ParkingCodeContext {
        private final String fullPrefix;
        private int nextSequence;

        private ParkingCodeContext(String fullPrefix, int nextSequence) {
            this.fullPrefix = fullPrefix;
            this.nextSequence = nextSequence;
        }

        private String nextCode(UjIdentifierService service) {
            String code = service.generateUnitCode(fullPrefix, nextSequence);
            nextSequence += 1;
            return code;
        }
    }
}
