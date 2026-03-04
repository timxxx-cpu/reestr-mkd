package uz.reestrmkd.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.entity.RoomEntity;
import uz.reestrmkd.backend.entity.UnitEntity;
import uz.reestrmkd.backend.enums.UnitType;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.UnitJpaRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class UnitService {

    private final JdbcTemplate jdbcTemplate;
    private final UnitJpaRepository unitJpaRepository;

    public UnitService(JdbcTemplate jdbcTemplate, UnitJpaRepository unitJpaRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.unitJpaRepository = unitJpaRepository;
    }

    @Transactional
    public UUID upsertUnit(Map<String, Object> source) {
        Map<String, Object> data = source == null ? Map.of() : source;
        UUID unitId = parseOptionalUuid(data.get("id"));
        UnitEntity unit = unitId == null
            ? new UnitEntity()
            : unitJpaRepository.findById(unitId).orElseGet(UnitEntity::new);

        Instant now = Instant.now();
        if (unit.getId() == null) {
            unit.setId(unitId == null ? UUID.randomUUID() : unitId);
            unit.setCreatedAt(now);
        }

        unit.setFloorId(parseRequiredUuid(data.get("floorId"), "floorId"));
        unit.setEntranceId(parseOptionalUuid(data.get("entranceId")));
        unit.setNumber(normalizeUnitNumber(data));
        unit.setUnitType(resolveUnitType(data).value());
        unit.setTotalArea(parseDecimal(data.get("totalArea")));
        unit.setLivingArea(parseDecimal(data.get("livingArea")));
        unit.setUsefulArea(parseDecimal(data.get("usefulArea")));
        unit.setRoomsCount(parseInteger(data.get("rooms")));
        unit.setStatus(asNullableString(data.get("status")));
        unit.setCadastreNumber(asNullableString(data.get("cadastreNumber")));
        unit.setAddressId(parseOptionalUuid(data.get("addressId")));
        unit.setHasMezzanine(parseBoolean(data.get("hasMezzanine")));
        unit.setMezzanineType(asNullableString(data.get("mezzanineType")));
        unit.setUpdatedAt(now);

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

        return unitJpaRepository.save(unit).getId();
    }

    public int batchUpsertUnits(List<Map<String, Object>> items) {
        List<NormalizedUnitPayload> normalizedItems = (items == null ? List.<Map<String, Object>>of() : items).stream()
            .map(this::normalizeUnitPayload)
            .toList();

        if (normalizedItems.isEmpty()) {
            return 0;
        }

        validateUnitNumbersUniqueWithinBuilding(normalizedItems);

        for (NormalizedUnitPayload unit : normalizedItems) {
            if (unit.id() == null) {
                jdbcTemplate.update(
                    "insert into units(id,floor_id,entrance_id,number,unit_type,total_area,living_area,useful_area,rooms_count,status,cadastre_number,address_id,created_at,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,?,?,?,?,?,now(),now())",
                    unit.floorId(), unit.entranceId(), unit.number(), unit.unitType(), unit.totalArea(), unit.livingArea(), unit.usefulArea(), unit.rooms(), unit.status(), unit.cadastreNumber(), unit.addressId()
                );
            } else {
                jdbcTemplate.update(
                    "update units set floor_id=?, entrance_id=?, number=?, unit_type=?, total_area=?, living_area=?, useful_area=?, rooms_count=?, status=?, cadastre_number=?, address_id=?, updated_at=now() where id=?",
                    unit.floorId(), unit.entranceId(), unit.number(), unit.unitType(), unit.totalArea(), unit.livingArea(), unit.usefulArea(), unit.rooms(), unit.status(), unit.cadastreNumber(), unit.addressId(), unit.id()
                );
            }
        }

        return normalizedItems.size();
    }

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
            id == null ? null : UUID.fromString(String.valueOf(id)),
            UUID.fromString(String.valueOf(floorId)),
            entranceId == null ? null : UUID.fromString(String.valueOf(entranceId)),
            number,
            unitType.value(),
            source.get("totalArea"),
            source.get("livingArea"),
            source.get("usefulArea"),
            source.get("rooms"),
            source.get("status"),
            source.get("cadastreNumber"),
            source.get("addressId")
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

    private void validateUnitNumbersUniqueWithinBuilding(List<NormalizedUnitPayload> items) {
        List<UUID> floorIds = items.stream().map(NormalizedUnitPayload::floorId).distinct().toList();
        String floorIn = String.join(",", Collections.nCopies(floorIds.size(), "?"));
        List<Map<String, Object>> floorRows = jdbcTemplate.queryForList(
            "select f.id as floor_id, bb.id as block_id, bb.building_id from floors f join building_blocks bb on bb.id=f.block_id where f.id in (" + floorIn + ")",
            floorIds.toArray()
        );

        Map<UUID, UUID> buildingByFloor = floorRows.stream().collect(Collectors.toMap(
            row -> UUID.fromString(String.valueOf(row.get("floor_id"))),
            row -> UUID.fromString(String.valueOf(row.get("building_id")))
        ));
        Map<UUID, UUID> blockByFloor = floorRows.stream().collect(Collectors.toMap(
            row -> UUID.fromString(String.valueOf(row.get("floor_id"))),
            row -> UUID.fromString(String.valueOf(row.get("block_id")))
        ));

        if (buildingByFloor.size() != floorIds.size()) {
            throw new ApiException("Some floorId values are invalid", "VALIDATION_ERROR", null, 400);
        }

        Map<String, UUID> seen = new HashMap<>();
        for (NormalizedUnitPayload item : items) {
            UUID buildingId = buildingByFloor.get(item.floorId());
            String normalizedNum = item.number().trim().toLowerCase();
            String key = buildingId + "::" + normalizedNum;
            if (seen.containsKey(key)) {
                UUID seenId = seen.get(key);
                if (item.id() == null || !item.id().equals(seenId)) {
                    throw new ApiException("Duplicate unit num in one building: " + item.number(), "VALIDATION_ERROR", null, 400);
                }
            } else {
                seen.put(key, item.id());
            }
        }

        Set<UUID> buildingIds = new HashSet<>(buildingByFloor.values());
        Set<String> numbers = items.stream().map(item -> item.number().trim().toLowerCase()).collect(Collectors.toSet());
        String buildingIn = String.join(",", Collections.nCopies(buildingIds.size(), "?"));
        String numberIn = String.join(",", Collections.nCopies(numbers.size(), "?"));

        List<Object> args = new ArrayList<>();
        args.addAll(buildingIds);
        args.addAll(numbers);
        List<Map<String, Object>> existingRows = jdbcTemplate.queryForList(
            "select u.id, lower(trim(u.number)) as unit_num, bb.id as block_id from units u join floors f on f.id=u.floor_id join building_blocks bb on bb.id=f.block_id where bb.building_id in (" + buildingIn + ") and lower(trim(u.number)) in (" + numberIn + ")",
            args.toArray()
        );

        for (Map<String, Object> row : existingRows) {
            UUID existingId = UUID.fromString(String.valueOf(row.get("id")));
            UUID existingBlockId = UUID.fromString(String.valueOf(row.get("block_id")));
            String existingNumber = String.valueOf(row.get("unit_num"));

            boolean presentInPayload = items.stream().anyMatch(item -> {
                UUID itemBlockId = blockByFloor.get(item.floorId());
                return existingBlockId.equals(itemBlockId)
                    && item.number().trim().equalsIgnoreCase(existingNumber)
                    && existingId.equals(item.id());
            });

            if (!presentInPayload) {
                throw new ApiException("Unit num already exists in block: " + existingNumber, "VALIDATION_ERROR", null, 400);
            }
        }
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

    private String asNullableString(Object value) {
        if (value == null) return null;
        String stringValue = String.valueOf(value).trim();
        return stringValue.isBlank() ? null : stringValue;
    }

    private record NormalizedUnitPayload(
        UUID id,
        UUID floorId,
        UUID entranceId,
        String number,
        String unitType,
        Object totalArea,
        Object livingArea,
        Object usefulArea,
        Object rooms,
        Object status,
        Object cadastreNumber,
        Object addressId
    ) {
    }
}
