package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FloorsReconcileService {

    private final JdbcTemplate jdbcTemplate;
    private final BuildingBlockJpaRepository blockRepo;
    private final BuildingJpaRepository buildingRepo;
    private final BlockFloorMarkerJpaRepository markerRepo;
    private final FloorGeneratorService floorGeneratorService;

    public FloorsReconcileService(
        JdbcTemplate jdbcTemplate,
        BuildingBlockJpaRepository blockRepo,
        BuildingJpaRepository buildingRepo,
        BlockFloorMarkerJpaRepository markerRepo,
        FloorGeneratorService floorGeneratorService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.blockRepo = blockRepo;
        this.buildingRepo = buildingRepo;
        this.markerRepo = markerRepo;
        this.floorGeneratorService = floorGeneratorService;
    }

    public FloorsReconcileResult reconcile(@NonNull UUID blockId) {
        BuildingBlockEntity block = blockRepo.findById(blockId)
            .orElseThrow(() -> new ApiException("Block not found", "NOT_FOUND", null, 404));
        BuildingEntity building = buildingRepo.findById(Objects.requireNonNull(block.getBuildingId()))
            .orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        List<BuildingBlockEntity> allBlocks = blockRepo.findByBuildingId(block.getBuildingId());
        List<BlockFloorMarkerEntity> markers = markerRepo.findByBlockIdIn(List.of(blockId));

        List<Map<String, Object>> existingFloors = jdbcTemplate.queryForList(
            "select id, index, parent_floor_index, basement_id from floors where block_id=?",
            blockId
        );
        List<Map<String, Object>> generated = floorGeneratorService.generateFloorsModel(block, building, allBlocks, markers);
        Set<String> seenKeys = new HashSet<>();
        List<Map<String, Object>> targetModel = generated.stream().filter(floor -> seenKeys.add(floorConstraintKey(floor))).toList();

        Map<String, Map<String, Object>> existingByKey = existingFloors.stream()
            .collect(Collectors.toMap(this::floorConstraintKey, row -> row, (a, b) -> a));

        List<UUID> usedExistingIds = new ArrayList<>();
        List<Map<String, Object>> toUpsert = new ArrayList<>();
        Instant now = Instant.now();

        for (Map<String, Object> floor : targetModel) {
            String cKey = floorConstraintKey(floor);
            Map<String, Object> existing = existingByKey.get(cKey);
            UUID id = existing == null ? UUID.randomUUID() : UUID.fromString(String.valueOf(existing.get("id")));
            if (existing != null) usedExistingIds.add(id);
            Map<String, Object> floorPayload = new HashMap<>(floor);
            floorPayload.put("id", id);
            floorPayload.put("updated_at", now);
            toUpsert.add(floorPayload);
        }

        List<UUID> toDeleteIds = existingFloors.stream()
            .map(row -> UUID.fromString(String.valueOf(row.get("id"))))
            .filter(id -> !usedExistingIds.contains(id))
            .toList();

        if (!toDeleteIds.isEmpty()) {
            Map<UUID, UUID> floorRemap = buildFloorRemap(toDeleteIds, toUpsert);
            remapFloorReferences(floorRemap);
        }

        if (!toDeleteIds.isEmpty()) {
            String in = String.join(",", Collections.nCopies(toDeleteIds.size(), "?"));
            jdbcTemplate.update("delete from floors where id in (" + in + ")", toDeleteIds.toArray());
        }

        for (Map<String, Object> floor : toUpsert) {
            jdbcTemplate.update(
                "insert into floors(id, block_id, index, floor_key, label, floor_type, height, area_proj, is_technical, is_commercial, is_stylobate, is_basement, is_attic, is_loft, is_roof, parent_floor_index, basement_id, updated_at) " +
                    "values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
                    "on conflict (id) do update set block_id=excluded.block_id, index=excluded.index, floor_key=excluded.floor_key, label=excluded.label, floor_type=excluded.floor_type, height=excluded.height, area_proj=excluded.area_proj, is_technical=excluded.is_technical, is_commercial=excluded.is_commercial, is_stylobate=excluded.is_stylobate, is_basement=excluded.is_basement, is_attic=excluded.is_attic, is_loft=excluded.is_loft, is_roof=excluded.is_roof, parent_floor_index=excluded.parent_floor_index, basement_id=excluded.basement_id, updated_at=excluded.updated_at",
                floor.get("id"), floor.get("block_id"), floor.get("index"), floor.get("floor_key"), floor.get("label"), floor.get("floor_type"), floor.get("height"), floor.get("area_proj"),
                floor.get("is_technical"), floor.get("is_commercial"), floor.get("is_stylobate"), floor.get("is_basement"), floor.get("is_attic"), floor.get("is_loft"), floor.get("is_roof"),
                floor.get("parent_floor_index"), floor.get("basement_id"), floor.get("updated_at")
            );
        }

        return new FloorsReconcileResult(toDeleteIds.size(), toUpsert.size());
    }

    private Map<UUID, UUID> buildFloorRemap(List<UUID> removedFloorIds, List<Map<String, Object>> toUpsert) {
        List<Map<String, Object>> removedFloors = jdbcTemplate.queryForList(
            "select id, index from floors where id in (" + String.join(",", Collections.nCopies(removedFloorIds.size(), "?")) + ")",
            removedFloorIds.toArray()
        );

        Map<UUID, Integer> removedIndex = new HashMap<>();
        for (Map<String, Object> row : removedFloors) {
            removedIndex.put(UUID.fromString(String.valueOf(row.get("id"))), toInt(row.get("index"), 0));
        }

        List<Map<String, Object>> targetFloors = toUpsert.stream().toList();
        Map<UUID, UUID> remap = new HashMap<>();
        for (UUID oldFloorId : removedFloorIds) {
            int oldIdx = removedIndex.getOrDefault(oldFloorId, 0);
            UUID candidate = targetFloors.stream()
                .min(Comparator.comparingInt(row -> Math.abs(toInt(row.get("index"), 0) - oldIdx)))
                .map(row -> UUID.fromString(String.valueOf(row.get("id"))))
                .orElse(null);
            if (candidate != null && !candidate.equals(oldFloorId)) {
                remap.put(oldFloorId, candidate);
            }
        }
        return remap;
    }

    private void remapFloorReferences(Map<UUID, UUID> floorRemap) {
        for (Map.Entry<UUID, UUID> entry : floorRemap.entrySet()) {
            jdbcTemplate.update("update units set floor_id=?, updated_at=now() where floor_id=?", entry.getValue(), entry.getKey());
            jdbcTemplate.update("update common_areas set floor_id=?, updated_at=now() where floor_id=?", entry.getValue(), entry.getKey());
            jdbcTemplate.update("update entrance_matrix set floor_id=?, updated_at=now() where floor_id=?", entry.getValue(), entry.getKey());
        }
    }

    private String floorConstraintKey(Map<String, Object> floor) {
        int index = toInt(floor.get("index"), 0);
        int parent = floor.get("parent_floor_index") == null ? -99999 : toInt(floor.get("parent_floor_index"), -99999);
        String basementId = floor.get("basement_id") == null ? "none" : String.valueOf(floor.get("basement_id"));
        return index + "|" + parent + "|" + basementId;
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

    public record FloorsReconcileResult(int deleted, int upserted) {
    }
}