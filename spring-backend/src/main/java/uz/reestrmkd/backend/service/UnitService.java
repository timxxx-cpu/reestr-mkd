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
    private final UjIdentifierService ujIdentifierService;

    public UnitService(JdbcTemplate jdbcTemplate, UnitJpaRepository unitJpaRepository, UjIdentifierService ujIdentifierService) {
        this.jdbcTemplate = jdbcTemplate;
        this.unitJpaRepository = unitJpaRepository;
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
            if (data.containsKey("hasMezzanine")) unit.setHasMezzanine(parseBoolean(data.get("hasMezzanine")));
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
            unit.setHasMezzanine(parseBoolean(data.get("hasMezzanine")));
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

      validateUnitNumbersUniqueWithinBlock(normalizedItems);

        // ИСПРАВЛЕНИЕ: Получаем building_id, building_code и uj_code проекта
        UUID sampleFloorId = normalizedItems.get(0).floorId();
        List<Map<String, Object>> bInfo = jdbcTemplate.queryForList(
            "select bb.building_id, b.building_code, p.uj_code " +
            "from floors f " +
            "join building_blocks bb on bb.id=f.block_id " +
            "join buildings b on b.id=bb.building_id " +
            "join projects p on p.id=b.project_id " +
            "where f.id=?", 
            sampleFloorId
        );
        
        UUID buildingId = bInfo.isEmpty() ? null : (UUID) bInfo.get(0).get("building_id");
        String buildingCode = bInfo.isEmpty() ? null : (String) bInfo.get(0).get("building_code");
        String ujCode = bInfo.isEmpty() ? null : (String) bInfo.get(0).get("uj_code");

        final List<String> existingCodes = buildingId != null ? jdbcTemplate.queryForList(
            "select u.unit_code from units u join floors f on f.id=u.floor_id join building_blocks bb on bb.id=f.block_id where bb.building_id=? and u.unit_code is not null",
            String.class,
            buildingId
        ) : List.of();

        Map<String, Integer> nextSeqByPrefix = new HashMap<>();
        int updated = 0;

        for (NormalizedUnitPayload unit : normalizedItems) {
            try {
                String finalUnitCode = unit.unitCode();
                List<Map<String, Object>> existing = jdbcTemplate.queryForList("select id, unit_code, unit_type from units where id = ?", unit.id());

                // Если код не передан, но юнит существует и тип не изменился — сохраняем старый код
                if (!existing.isEmpty() && finalUnitCode == null) {
                    String existingType = (String) existing.get(0).get("unit_type");
                    if (unit.unitType().equals(existingType)) {
                        finalUnitCode = (String) existing.get(0).get("unit_code");
                    }
                }

                // ИСПРАВЛЕНИЕ: Формируем полный префикс по формату UJ000000-ZD00-EL
              if (finalUnitCode == null) {
                    String basePrefix = ujIdentifierService.getUnitPrefix(unit.unitType());
                    
                    String fullPrefix;
                    if (buildingCode != null && !buildingCode.isBlank()) {
                        // Если код здания уже содержит код ЖК (например, UJ683390-ZM01), мы не дублируем ujCode
                        if (ujCode != null && buildingCode.startsWith(ujCode)) {
                            fullPrefix = buildingCode + "-" + basePrefix;
                        } else {
                            // Иначе склеиваем: ЖК + Здание + Юнит
                            fullPrefix = (ujCode != null && !ujCode.isBlank() ? ujCode + "-" : "") + buildingCode + "-" + basePrefix;
                        }
                    } else {
                        // Если здания нет (аномалия), клеим ЖК + Юнит
                        fullPrefix = (ujCode != null && !ujCode.isBlank() ? ujCode + "-" : "") + basePrefix;
                    }
                    
                    int seq = nextSeqByPrefix.computeIfAbsent(fullPrefix, p -> ujIdentifierService.getNextSequenceNumber(existingCodes, p));
                    finalUnitCode = ujIdentifierService.generateUnitCode(fullPrefix, seq);
                    nextSeqByPrefix.put(fullPrefix, seq + 1);
                }

                if (existing.isEmpty()) {
                    jdbcTemplate.update(
                        "insert into units(id,floor_id,entrance_id,number,unit_type,total_area,living_area,useful_area,rooms_count,status,cadastre_number,address_id,unit_code,created_at,updated_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,now(),now())",
                        unit.id(), unit.floorId(), unit.entranceId(), unit.number(), unit.unitType(), unit.totalArea(), unit.livingArea(), unit.usefulArea(), unit.rooms(), 
                        unit.status() != null ? unit.status() : "free", 
                        unit.cadastreNumber(), unit.addressId(), finalUnitCode
                    );
                } else {
                    jdbcTemplate.update(
                        "update units set floor_id=?, entrance_id=?, number=?, unit_type=?, total_area=?, living_area=?, useful_area=?, rooms_count=?, status=?, cadastre_number=?, address_id=?, unit_code=?, updated_at=now() where id=?",
                        unit.floorId(), unit.entranceId(), unit.number(), unit.unitType(), unit.totalArea(), unit.livingArea(), unit.usefulArea(), unit.rooms(), 
                        unit.status() != null ? unit.status() : "free", 
                        unit.cadastreNumber(), unit.addressId(), finalUnitCode, unit.id()
                    );
                }
                updated++;
            } catch (Exception e) {
                e.printStackTrace();
                throw new ApiException("Batch update failed for unit " + unit.number() + ": " + e.getMessage(), "DB_ERROR", e.getMessage(), 400);
            }
        }

        return updated;
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
            firstPresent(source, "totalArea", "area"),
            source.get("livingArea"),
            source.get("usefulArea"),
            source.get("rooms"),
            source.containsKey("isSold") ? (Boolean.TRUE.equals(source.get("isSold")) ? "sold" : "free") : source.get("status"),
            source.get("cadastreNumber"),
            source.get("addressId"),
            source.containsKey("unitCode") ? (String) source.get("unitCode") : null
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

    private void validateUnitNumbersUniqueWithinBlock(List<NormalizedUnitPayload> items) {
        List<UUID> floorIds = items.stream().map(NormalizedUnitPayload::floorId).distinct().toList();
        String floorIn = String.join(",", Collections.nCopies(floorIds.size(), "?"));
        
        // Получаем block_id для каждого этажа (без привязки к зданию)
        List<Map<String, Object>> floorRows = jdbcTemplate.queryForList(
            "select f.id as floor_id, bb.id as block_id from floors f join building_blocks bb on bb.id=f.block_id where f.id in (" + floorIn + ")",
            floorIds.toArray()
        );

        Map<UUID, UUID> blockByFloor = floorRows.stream().collect(Collectors.toMap(
            row -> UUID.fromString(String.valueOf(row.get("floor_id"))),
            row -> UUID.fromString(String.valueOf(row.get("block_id")))
        ));

        if (blockByFloor.size() != floorIds.size()) {
            throw new ApiException("Some floorId values are invalid", "VALIDATION_ERROR", null, 400);
        }

        // Проверяем дубликаты внутри присланного списка (ограничиваем по blockId)
        Map<String, UUID> seen = new HashMap<>();
        for (NormalizedUnitPayload item : items) {
            UUID blockId = blockByFloor.get(item.floorId());
            String normalizedNum = item.number().trim().toLowerCase();
            String key = blockId + "::" + normalizedNum;
            if (seen.containsKey(key)) {
                UUID seenId = seen.get(key);
                if (item.id() == null || !item.id().equals(seenId)) {
                    throw new ApiException("Duplicate unit num in one block: " + item.number(), "VALIDATION_ERROR", null, 400);
                }
            } else {
                seen.put(key, item.id());
            }
        }

        // Проверяем дубликаты в базе данных (ограничиваем по blockId)
        Set<UUID> blockIds = new HashSet<>(blockByFloor.values());
        Set<String> numbers = items.stream().map(item -> item.number().trim().toLowerCase()).collect(Collectors.toSet());
        String blockIn = String.join(",", Collections.nCopies(blockIds.size(), "?"));
        String numberIn = String.join(",", Collections.nCopies(numbers.size(), "?"));

        List<Object> args = new ArrayList<>();
        args.addAll(blockIds);
        args.addAll(numbers);
        List<Map<String, Object>> existingRows = jdbcTemplate.queryForList(
            "select u.id, lower(trim(u.number)) as unit_num, bb.id as block_id from units u join floors f on f.id=u.floor_id join building_blocks bb on bb.id=f.block_id where bb.id in (" + blockIn + ") and lower(trim(u.number)) in (" + numberIn + ")",
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
        Object addressId,
        String unitCode
    ) {
    }
}