package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.common.service.UjIdentifierService;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.RoomEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitType;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class UnitService {

    private final UnitJpaRepository unitJpaRepository;
    private final FloorJpaRepository floorJpaRepository;
    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final BuildingJpaRepository buildingJpaRepository;
    private final ProjectJpaRepository projectJpaRepository;
    private final UjIdentifierService ujIdentifierService;

    public UnitService(
        UnitJpaRepository unitJpaRepository,
        FloorJpaRepository floorJpaRepository,
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        BuildingJpaRepository buildingJpaRepository,
        ProjectJpaRepository projectJpaRepository,
        UjIdentifierService ujIdentifierService
    ) {
        this.unitJpaRepository = unitJpaRepository;
        this.floorJpaRepository = floorJpaRepository;
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.buildingJpaRepository = buildingJpaRepository;
        this.projectJpaRepository = projectJpaRepository;
        this.ujIdentifierService = ujIdentifierService;
    }

    @Transactional
    public UUID upsertUnit(Map<String, Object> source) {
        Map<String, Object> data = source == null ? Map.of() : source;
        UUID unitId = parseOptionalUuid(data.get("id"));
        boolean isPatch = unitId != null && (data.get("floorId") == null || data.get("type") == null);

        UnitEntity unit;
        if (unitId == null) {
            unit = new UnitEntity();
        } else {
            unit = unitJpaRepository.findById(unitId)
                .orElseThrow(() -> new ApiException("Unit not found", "NOT_FOUND", null, 404));
        }

        if (unit.getHasMezzanine() == null) {
            unit.setHasMezzanine(Boolean.FALSE);
        }

        Instant now = Instant.now();
        if (unit.getId() == null) {
            unit.setId(UUID.randomUUID());
            unit.setCreatedAt(now);
        }

        if (isPatch) {
            if (data.containsKey("num") || data.containsKey("number")) {
                unit.setNumber(normalizeUnitNumber(data));
            }
            if (data.containsKey("type") || data.containsKey("unitType")) {
                unit.setUnitType(resolveUnitType(data).value());
            }
            if (data.containsKey("area") || data.containsKey("totalArea")) {
                unit.setTotalArea(parseDecimal(firstPresent(data, "area", "totalArea")));
            }
            if (data.containsKey("livingArea")) unit.setLivingArea(parseDecimal(data.get("livingArea")));
            if (data.containsKey("usefulArea")) unit.setUsefulArea(parseDecimal(data.get("usefulArea")));
            if (data.containsKey("rooms")) unit.setRoomsCount(parseInteger(data.get("rooms")));
            if (data.containsKey("status")) unit.setStatus(asNullableString(data.get("status")));
            if (data.containsKey("isSold")) unit.setStatus(Boolean.TRUE.equals(data.get("isSold")) ? "sold" : "free");
            if (data.containsKey("cadastreNumber")) unit.setCadastreNumber(asNullableString(data.get("cadastreNumber")));
            if (data.containsKey("addressId")) unit.setAddressId(parseOptionalUuid(data.get("addressId")));
            if (data.containsKey("hasMezzanine")) unit.setHasMezzanine(parseBooleanOrDefaultFalse(data.get("hasMezzanine")));
            if (data.containsKey("mezzanineType")) unit.setMezzanineType(asNullableString(data.get("mezzanineType")));
        } else {
            unit.setFloorId(parseRequiredUuid(data.get("floorId"), "floorId"));
            unit.setEntranceId(parseOptionalUuid(data.get("entranceId")));
            unit.setNumber(normalizeUnitNumber(data));
            unit.setUnitType(resolveUnitType(data).value());
            unit.setTotalArea(parseDecimal(firstPresent(data, "totalArea", "area")));
            unit.setLivingArea(parseDecimal(data.get("livingArea")));
            unit.setUsefulArea(parseDecimal(data.get("usefulArea")));
            unit.setRoomsCount(parseInteger(data.get("rooms")));
            unit.setStatus(asNullableString(data.get("status")));
            if (data.containsKey("isSold")) unit.setStatus(Boolean.TRUE.equals(data.get("isSold")) ? "sold" : "free");
            unit.setCadastreNumber(asNullableString(data.get("cadastreNumber")));
            unit.setAddressId(parseOptionalUuid(data.get("addressId")));
            unit.setHasMezzanine(parseBooleanOrDefaultFalse(data.get("hasMezzanine")));
            unit.setMezzanineType(asNullableString(data.get("mezzanineType")));
        }

        unit.setUpdatedAt(now);

        if (data.containsKey("explication") || data.containsKey("rooms")) {
            List<Map<String, Object>> roomsPayload = extractRoomsPayload(data);
            unit.getRooms().clear();
            for (Map<String, Object> roomData : roomsPayload) {
                RoomEntity room = new RoomEntity();
                room.setId(parseOptionalUuid(roomData.get("id")));
                if (room.getId() == null) {
                    room.setId(UUID.randomUUID());
                    room.setCreatedAt(now);
                }
                room.setUnit(unit);
                room.setRoomType(asNullableString(roomData.getOrDefault("type", roomData.get("room_type"))));
                room.setName(asNullableString(roomData.getOrDefault("label", roomData.get("name"))));
                room.setArea(parseDecimal(roomData.get("area")));
                room.setRoomHeight(parseDecimal(roomData.getOrDefault("height", roomData.get("room_height"))));
                room.setLevel(parseInteger(roomData.get("level")));
                room.setIsMezzanine(parseBoolean(roomData.getOrDefault("isMezzanine", roomData.get("is_mezzanine"))));
                room.setUpdatedAt(now);
                unit.getRooms().add(room);
            }
        }

        return unitJpaRepository.save(unit).getId();
    }

    @Transactional
    public int batchUpsertUnits(List<Map<String, Object>> items) {
        List<NormalizedUnitPayload> normalizedItems = (items == null ? List.<Map<String, Object>>of() : items).stream()
            .map(this::normalizeUnitPayload)
            .toList();

        if (normalizedItems.isEmpty()) {
            return 0;
        }

        UnitBatchContext context = loadBatchContext(normalizedItems);
        validateUnitNumbersUniqueWithinBlock(normalizedItems, context.blockByFloorId());

        Map<UUID, UnitEntity> existingUnitsById = findUnitsByIds(
            normalizedItems.stream()
                .map(NormalizedUnitPayload::id)
                .filter(Objects::nonNull)
                .distinct()
                .toList()
        ).stream().collect(Collectors.toMap(UnitEntity::getId, unit -> unit));

        Map<String, Integer> nextSequenceByPrefix = new HashMap<>();
        Instant now = Instant.now();
        List<UnitEntity> unitsToSave = new ArrayList<>();

        for (NormalizedUnitPayload unit : normalizedItems) {
            try {
                FloorEntity floor = context.floorById().get(unit.floorId());
                BuildingBlockEntity block = context.blockById().get(floor.getBlockId());
                BuildingEntity building = context.buildingById().get(block.getBuildingId());
                ProjectEntity project = context.projectById().get(building.getProjectId());

                UnitEntity entity = existingUnitsById.get(unit.id());
                if (entity == null) {
                    entity = new UnitEntity();
                    entity.setId(unit.id() != null ? unit.id() : UUID.randomUUID());
                    entity.setCreatedAt(now);
                }

                String finalUnitCode = unit.unitCode();
                if (finalUnitCode == null && unit.unitType().equals(entity.getUnitType())) {
                    finalUnitCode = entity.getUnitCode();
                }

                if (finalUnitCode == null) {
                    String basePrefix = ujIdentifierService.getUnitPrefix(unit.unitType());
                    String fullPrefix = buildFullUnitPrefix(project.getUjCode(), building.getBuildingCode(), basePrefix);
                    String sequenceKey = building.getId() + "::" + fullPrefix;
                    int nextSequence = nextSequenceByPrefix.computeIfAbsent(
                        sequenceKey,
                        key -> ujIdentifierService.getNextSequenceNumber(
                            context.existingUnitCodesByBuildingId().getOrDefault(building.getId(), List.of()),
                            fullPrefix
                        )
                    );
                    finalUnitCode = ujIdentifierService.generateUnitCode(fullPrefix, nextSequence);
                    nextSequenceByPrefix.put(sequenceKey, nextSequence + 1);
                }

                entity.setFloorId(unit.floorId());
                entity.setEntranceId(unit.entranceId());
                entity.setNumber(unit.number());
                entity.setUnitType(unit.unitType());
                entity.setTotalArea(unit.totalArea());
                entity.setLivingArea(unit.livingArea());
                entity.setUsefulArea(unit.usefulArea());
                entity.setRoomsCount(unit.rooms());
                entity.setStatus(unit.status() != null ? unit.status() : "free");
                entity.setCadastreNumber(unit.cadastreNumber());
                entity.setAddressId(unit.addressId());
                entity.setHasMezzanine(unit.hasMezzanine() == null ? Boolean.FALSE : unit.hasMezzanine());
                entity.setMezzanineType(unit.mezzanineType());
                entity.setUnitCode(finalUnitCode);
                entity.setUpdatedAt(now);
                unitsToSave.add(entity);
            } catch (Exception e) {
                e.printStackTrace();
                throw new ApiException("Batch update failed for unit " + unit.number() + ": " + e.getMessage(), "DB_ERROR", e.getMessage(), 400);
            }
        }

        unitJpaRepository.saveAll(unitsToSave);
        return unitsToSave.size();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractRoomsPayload(Map<String, Object> data) {
        Object explication = data.get("explication");
        if (explication instanceof List<?> list) {
            return list.stream().filter(Map.class::isInstance).map(v -> (Map<String, Object>) v).toList();
        }
        Object rooms = data.get("rooms");
        if (rooms instanceof List<?> list) {
            return list.stream().filter(Map.class::isInstance).map(v -> (Map<String, Object>) v).toList();
        }
        return List.of();
    }

    private NormalizedUnitPayload normalizeUnitPayload(Map<String, Object> source) {
        UnitType unitType = resolveUnitType(source);

        Object floorId = source.get("floorId");
        if (floorId == null) {
            throw new ApiException("floorId is required", "VALIDATION_ERROR", null, 400);
        }

        String number = normalizeUnitNumber(source);
        Object id = source.get("id");
        Object entranceId = source.get("entranceId");

        return new NormalizedUnitPayload(
            parseOptionalUuid(id),
            parseRequiredUuid(floorId, "floorId"),
            parseOptionalUuid(entranceId),
            number,
            unitType.value(),
            parseDecimal(firstPresent(source, "totalArea", "area")),
            parseDecimal(source.get("livingArea")),
            parseDecimal(source.get("usefulArea")),
            parseInteger(source.get("rooms")),
            source.containsKey("isSold") ? (Boolean.TRUE.equals(source.get("isSold")) ? "sold" : "free") : asNullableString(source.get("status")),
            asNullableString(source.get("cadastreNumber")),
            parseOptionalUuid(source.get("addressId")),
            source.containsKey("hasMezzanine") ? parseBooleanOrDefaultFalse(source.get("hasMezzanine")) : Boolean.FALSE,
            source.containsKey("mezzanineType") ? asNullableString(source.get("mezzanineType")) : null,
            source.containsKey("unitCode") ? asNullableString(source.get("unitCode")) : null
        );
    }

    private UnitType resolveUnitType(Map<String, Object> source) {
        String rawType = String.valueOf(source.getOrDefault("type", source.get("unitType")));
        try {
            return UnitType.fromValue(rawType);
        } catch (IllegalArgumentException ex) {
            throw new ApiException(ex.getMessage(), "VALIDATION_ERROR", null, 400);
        }
    }

    private String normalizeUnitNumber(Map<String, Object> source) {
        String number = String.valueOf(source.getOrDefault("num", source.getOrDefault("number", ""))).trim();
        if (number.isBlank()) {
            throw new ApiException("Unit num is required", "VALIDATION_ERROR", null, 400);
        }
        return number;
    }

    private void validateUnitNumbersUniqueWithinBlock(List<NormalizedUnitPayload> items, Map<UUID, UUID> blockByFloor) {
        Map<String, UUID> seen = new HashMap<>();
        for (NormalizedUnitPayload item : items) {
            UUID blockId = blockByFloor.get(item.floorId());
            String normalizedNumber = item.number().trim().toLowerCase();
            String key = blockId + "::" + normalizedNumber;
            if (seen.containsKey(key)) {
                UUID seenId = seen.get(key);
                if (item.id() == null || !item.id().equals(seenId)) {
                    throw new ApiException("Duplicate unit num in one block: " + item.number(), "VALIDATION_ERROR", null, 400);
                }
            } else {
                seen.put(key, item.id());
            }
        }

        Set<UUID> blockIds = new HashSet<>(blockByFloor.values());
        Set<String> numbers = items.stream()
            .map(item -> item.number().trim().toLowerCase())
            .collect(Collectors.toSet());

        List<UnitJpaRepository.UnitNumberConflictRow> existingRows = unitJpaRepository.findUnitNumberConflicts(blockIds, numbers);
        Set<UUID> payloadIds = items.stream()
            .map(NormalizedUnitPayload::id)
            .filter(Objects::nonNull)
            .collect(Collectors.toSet());

        for (UnitJpaRepository.UnitNumberConflictRow row : existingRows) {
            if (payloadIds.contains(row.getId())) {
                continue;
            }

            boolean conflictsByNumber = items.stream().anyMatch(item -> {
                UUID itemBlockId = blockByFloor.get(item.floorId());
                return row.getBlockId().equals(itemBlockId)
                    && item.number().trim().equalsIgnoreCase(row.getNormalizedNumber());
            });

            if (conflictsByNumber) {
                throw new ApiException("Unit num already exists in block: " + row.getNormalizedNumber(), "VALIDATION_ERROR", null, 400);
            }
        }
    }

    private UnitBatchContext loadBatchContext(List<NormalizedUnitPayload> items) {
        List<UUID> floorIds = items.stream().map(NormalizedUnitPayload::floorId).distinct().toList();
        Map<UUID, FloorEntity> floorById = findFloorsByIds(floorIds).stream()
            .collect(Collectors.toMap(FloorEntity::getId, floor -> floor));
        if (floorById.size() != floorIds.size()) {
            throw new ApiException("Some floorId values are invalid", "VALIDATION_ERROR", null, 400);
        }

        List<UUID> blockIds = floorById.values().stream()
            .map(FloorEntity::getBlockId)
            .distinct()
            .toList();
        Map<UUID, BuildingBlockEntity> blockById = findBlocksByIds(blockIds).stream()
            .collect(Collectors.toMap(BuildingBlockEntity::getId, block -> block));
        if (blockById.size() != blockIds.size()) {
            throw new ApiException("Some block values are invalid", "VALIDATION_ERROR", null, 400);
        }

        List<UUID> buildingIds = blockById.values().stream()
            .map(BuildingBlockEntity::getBuildingId)
            .distinct()
            .toList();
        Map<UUID, BuildingEntity> buildingById = findBuildingsByIds(buildingIds).stream()
            .collect(Collectors.toMap(BuildingEntity::getId, building -> building));
        if (buildingById.size() != buildingIds.size()) {
            throw new ApiException("Some building values are invalid", "VALIDATION_ERROR", null, 400);
        }

        List<UUID> projectIds = buildingById.values().stream()
            .map(BuildingEntity::getProjectId)
            .distinct()
            .toList();
        Map<UUID, ProjectEntity> projectById = findProjectsByIds(projectIds).stream()
            .collect(Collectors.toMap(ProjectEntity::getId, project -> project));
        if (projectById.size() != projectIds.size()) {
            throw new ApiException("Some project values are invalid", "VALIDATION_ERROR", null, 400);
        }

        Map<UUID, UUID> blockByFloorId = floorById.values().stream()
            .collect(Collectors.toMap(FloorEntity::getId, FloorEntity::getBlockId));

        Map<UUID, List<String>> existingUnitCodesByBuildingId = unitJpaRepository.findUnitCodesByBuildingIds(buildingIds).stream()
            .filter(row -> row.getUnitCode() != null && !row.getUnitCode().isBlank())
            .collect(Collectors.groupingBy(
                UnitJpaRepository.BuildingUnitCodeRow::getBuildingId,
                Collectors.mapping(UnitJpaRepository.BuildingUnitCodeRow::getUnitCode, Collectors.toList())
            ));

        return new UnitBatchContext(floorById, blockById, buildingById, projectById, blockByFloorId, existingUnitCodesByBuildingId);
    }

    private Object firstPresent(Map<String, Object> source, String... keys) {
        for (String key : keys) {
            if (source.containsKey(key)) return source.get(key);
        }
        return null;
    }

    private UUID parseRequiredUuid(Object value, String fieldName) {
        UUID parsed = parseOptionalUuid(value);
        if (parsed == null) {
            throw new ApiException(fieldName + " is required", "VALIDATION_ERROR", null, 400);
        }
        return parsed;
    }

    private UUID parseOptionalUuid(Object value) {
        if (value == null) return null;
        String stringValue = String.valueOf(value).trim();
        if (stringValue.isBlank()) return null;
        try {
            return UUID.fromString(stringValue);
        } catch (IllegalArgumentException ex) {
            throw new ApiException("Invalid UUID: " + stringValue, "VALIDATION_ERROR", null, 400);
        }
    }

    private BigDecimal parseDecimal(Object value) {
        if (value == null) return null;
        String stringValue = String.valueOf(value).trim();
        if (stringValue.isBlank()) return null;
        stringValue = stringValue.replace(',', '.');
        try {
            return new BigDecimal(stringValue);
        } catch (NumberFormatException ex) {
            throw new ApiException("Invalid numeric value: " + stringValue, "VALIDATION_ERROR", null, 400);
        }
    }

    private Integer parseInteger(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.intValue();
        String stringValue = String.valueOf(value).trim();
        if (stringValue.isBlank()) return null;
        try {
            return Integer.parseInt(stringValue);
        } catch (NumberFormatException ex) {
            throw new ApiException("Invalid integer value: " + stringValue, "VALIDATION_ERROR", null, 400);
        }
    }

    private Boolean parseBoolean(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean booleanValue) return booleanValue;
        return Boolean.parseBoolean(String.valueOf(value));
    }

    private Boolean parseBooleanOrDefaultFalse(Object value) {
        Boolean parsed = parseBoolean(value);
        return parsed == null ? Boolean.FALSE : parsed;
    }

    private String asNullableString(Object value) {
        if (value == null) return null;
        String stringValue = String.valueOf(value).trim();
        return stringValue.isBlank() ? null : stringValue;
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

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private List<UnitEntity> findUnitsByIds(List<UUID> unitIds) {
        return unitJpaRepository.findAllById(new ArrayList<>(unitIds));
    }

    private List<FloorEntity> findFloorsByIds(List<UUID> floorIds) {
        return floorJpaRepository.findAllById(new ArrayList<>(floorIds));
    }

    private List<BuildingBlockEntity> findBlocksByIds(List<UUID> blockIds) {
        return buildingBlockJpaRepository.findAllById(new ArrayList<>(blockIds));
    }

    private List<BuildingEntity> findBuildingsByIds(List<UUID> buildingIds) {
        return buildingJpaRepository.findAllById(new ArrayList<>(buildingIds));
    }

    private List<ProjectEntity> findProjectsByIds(List<UUID> projectIds) {
        return projectJpaRepository.findAllById(new ArrayList<>(projectIds));
    }

    private record NormalizedUnitPayload(
        UUID id,
        UUID floorId,
        UUID entranceId,
        String number,
        String unitType,
        BigDecimal totalArea,
        BigDecimal livingArea,
        BigDecimal usefulArea,
        Integer rooms,
        String status,
        String cadastreNumber,
        UUID addressId,
        Boolean hasMezzanine,
        String mezzanineType,
        String unitCode
    ) {
    }

    private record UnitBatchContext(
        Map<UUID, FloorEntity> floorById,
        Map<UUID, BuildingBlockEntity> blockById,
        Map<UUID, BuildingEntity> buildingById,
        Map<UUID, ProjectEntity> projectById,
        Map<UUID, UUID> blockByFloorId,
        Map<UUID, List<String>> existingUnitCodesByBuildingId
    ) {
    }
}
