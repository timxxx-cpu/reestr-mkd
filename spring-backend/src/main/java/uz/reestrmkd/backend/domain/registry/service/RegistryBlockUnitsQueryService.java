package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RegistryBlockUnitsQueryService {

    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;
    private final UnitJpaRepository unitJpaRepository;

    public RegistryBlockUnitsQueryService(
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository,
        UnitJpaRepository unitJpaRepository
    ) {
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
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

        List<UnitJpaRepository.BlockUnitRow> rows = floorUuidIds.isEmpty()
            ? unitJpaRepository.findBlockUnitRowsByBlockId(blockId)
            : unitJpaRepository.findBlockUnitRowsByBlockIdOrFloorIdIn(blockId, floorUuidIds);

        List<Map<String, Object>> units = rows.stream()
            .filter(row -> matchesSearch(row, search))
            .filter(row -> matchesType(row, type))
            .filter(row -> matchesBuilding(row, building))
            .filter(row -> matchesFloor(row, floor))
            .sorted(unitRowComparator())
            .skip(offset)
            .limit(normalizedLimit)
            .map(this::toUnitMap)
            .toList();

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

    private Comparator<UnitJpaRepository.BlockUnitRow> unitRowComparator() {
        return Comparator
            .comparing(
                UnitJpaRepository.BlockUnitRow::getNumber,
                Comparator.nullsLast(String::compareToIgnoreCase)
            )
            .thenComparing(
                UnitJpaRepository.BlockUnitRow::getCreatedAt,
                Comparator.nullsLast(Comparator.naturalOrder())
            );
    }

    private boolean matchesSearch(UnitJpaRepository.BlockUnitRow row, String search) {
        if (search == null || search.isBlank()) {
            return true;
        }
        String needle = search.toLowerCase();
        return containsIgnoreCase(row.getNumber(), needle) || containsIgnoreCase(row.getUnitCode(), needle);
    }

    private boolean matchesType(UnitJpaRepository.BlockUnitRow row, String type) {
        return type == null || type.isBlank() || type.equals(row.getUnitType());
    }

    private boolean matchesBuilding(UnitJpaRepository.BlockUnitRow row, String building) {
        if (building == null || building.isBlank()) {
            return true;
        }
        String needle = building.toLowerCase();
        return containsIgnoreCase(row.getBuildingLabel(), needle) || containsIgnoreCase(row.getBuildingHouseNumber(), needle);
    }

    private boolean matchesFloor(UnitJpaRepository.BlockUnitRow row, String floor) {
        if (floor == null || floor.isBlank()) {
            return true;
        }
        String needle = floor.toLowerCase();
        return containsIgnoreCase(row.getFloorLabel(), needle) || containsIgnoreCase(stringValue(row.getFloorIndex()), needle);
    }

    private boolean containsIgnoreCase(String value, String needle) {
        return value != null && value.toLowerCase().contains(needle);
    }

    private String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Map<String, Object> toUnitMap(UnitJpaRepository.BlockUnitRow row) {
        Map<String, Object> unit = new HashMap<>();
        unit.put("id", row.getId());
        unit.put("floor_id", row.getFloorId());
        unit.put("extension_id", row.getExtensionId());
        unit.put("entrance_id", row.getEntranceId());
        unit.put("unit_code", row.getUnitCode());
        unit.put("number", row.getNumber());
        unit.put("unit_type", row.getUnitType());
        unit.put("has_mezzanine", row.getHasMezzanine());
        unit.put("mezzanine_type", row.getMezzanineType());
        unit.put("total_area", row.getTotalArea());
        unit.put("living_area", row.getLivingArea());
        unit.put("useful_area", row.getUsefulArea());
        unit.put("rooms_count", row.getRoomsCount());
        unit.put("status", row.getStatus());
        unit.put("cadastre_number", row.getCadastreNumber());
        unit.put("address_id", row.getAddressId());
        unit.put("created_at", row.getCreatedAt());
        unit.put("updated_at", row.getUpdatedAt());
        return unit;
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
