package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RegistryBlockUnitsQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;

    public RegistryBlockUnitsQueryService(
        JdbcTemplate jdbcTemplate,
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
    }

    public Map<String, Object> loadUnits(
        UUID blockId,
        String floorIds,
        String search,
        String type,
        String building,
        String floor,
        Integer page,
        Integer limit
    ) {
        int normalizedPage = Math.max(1, page == null ? 1 : page);
        int normalizedLimit = Math.min(1000, Math.max(1, limit == null ? 1000 : limit));
        int offset = (normalizedPage - 1) * normalizedLimit;
        List<UUID> floorUuidIds = parseFloorIds(floorIds);

        StringBuilder sql = new StringBuilder("""
            select u.*
            from units u
            join floors f on f.id=u.floor_id
            join building_blocks bb on bb.id=f.block_id
            join buildings b on b.id=bb.building_id
            where (f.block_id=?
        """);
        List<Object> args = new ArrayList<>();
        args.add(blockId);

        if (!floorUuidIds.isEmpty()) {
            sql.append(" or u.floor_id in (").append(String.join(",", Collections.nCopies(floorUuidIds.size(), "?"))).append(")");
            args.addAll(floorUuidIds);
        }
        sql.append(")");

        if (search != null && !search.isBlank()) {
            sql.append(" and (coalesce(u.number,'') ilike ? or coalesce(u.unit_code,'') ilike ?)");
            String like = "%" + search + "%";
            args.add(like);
            args.add(like);
        }
        if (type != null && !type.isBlank()) {
            sql.append(" and u.unit_type=?");
            args.add(type);
        }
        if (building != null && !building.isBlank()) {
            sql.append(" and (coalesce(b.label,'') ilike ? or coalesce(b.house_number,'') ilike ?)");
            String like = "%" + building + "%";
            args.add(like);
            args.add(like);
        }
        if (floor != null && !floor.isBlank()) {
            sql.append(" and (coalesce(f.label,'') ilike ? or cast(f.index as text) ilike ?)");
            String like = "%" + floor + "%";
            args.add(like);
            args.add(like);
        }
        sql.append(" order by u.number asc nulls last, u.created_at asc limit ? offset ?");
        args.add(normalizedLimit);
        args.add(offset);

        List<Map<String, Object>> units = jdbcTemplate.queryForList(Objects.requireNonNull(sql.toString()), args.toArray());

        Set<UUID> entranceBlockIds = new LinkedHashSet<>();
        entranceBlockIds.add(blockId);
        entranceBlockIds.addAll(resolveBlockIdsByFloorIds(floorUuidIds));

        Map<String, Integer> entranceMap = entranceJpaRepository.findByBlockIdInOrderByNumberAsc(entranceBlockIds).stream()
            .collect(Collectors.toMap(
                entrance -> entrance.getId().toString(),
                entrance -> entrance.getNumber() == null ? 0 : entrance.getNumber(),
                (v1, v2) -> v1,
                HashMap::new
            ));

        Map<String, Object> result = new HashMap<>();
        result.put("units", units);
        result.put("entranceMap", entranceMap);
        return result;
    }

    private List<UUID> resolveBlockIdsByFloorIds(List<UUID> floorIds) {
        if (floorIds.isEmpty()) {
            return List.of();
        }

        return floorJpaRepository.findAllById(floorIds).stream()
            .map(FloorEntity::getBlockId)
            .distinct()
            .toList();
    }

    private List<UUID> parseFloorIds(String floorIds) {
        if (floorIds == null || floorIds.isBlank()) {
            return List.of();
        }

        return Arrays.stream(floorIds.split(","))
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .map(this::tryParseUuid)
            .filter(java.util.Objects::nonNull)
            .toList();
    }

    private UUID tryParseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}