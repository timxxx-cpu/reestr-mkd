package uz.reestrmkd.backend.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Array;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

public final class ValidationUtils {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final List<String> BASEMENT_COMM_KEYS = List.of(
        "electricity", "water", "sewerage", "heating", "ventilation", "gas", "firefighting"
    );

    private ValidationUtils() {
    }

    public static ValidationError buildValidationError(String code, String title, String message, Map<String, Object> meta) {
        return new ValidationError(code, title, message, meta == null ? Map.of() : meta);
    }

    public static String getEntityTitle(BuildingData building, BlockData block) {
        String bCodeStr = building != null && !isBlank(building.buildingCode()) ? "[" + building.buildingCode() + "] " : "";
        String houseStr = building != null && !isBlank(building.houseNumber()) ? " (д. " + building.houseNumber() + ")" : "";
        String bLabel = building != null && !isBlank(building.label()) ? building.label() : "Неизвестный объект";

        if (block == null) {
            return bCodeStr + "Объект: " + bLabel + houseStr;
        }

        String blkLabel = !isBlank(block.label()) ? block.label() : "Основной блок";
        return bCodeStr + "Объект: " + bLabel + houseStr + " (Блок: " + blkLabel + ")";
    }

    public static ValidationResult buildStepValidationResult(JdbcTemplate jdbcTemplate, UUID projectId, String stepId) {
        String normalizedStepId = stepId == null ? "" : stepId.trim();
        List<ValidationError> errors = new ArrayList<>();

        try {
            List<BuildingData> allBuildings = fetchBuildingsWithBlocks(jdbcTemplate, projectId);
            List<BlockData> allBlocks = allBuildings.stream()
                .flatMap(b -> b.blocks().stream())
                .toList();
            List<BlockData> residentialBlocks = allBlocks.stream()
                .filter(block -> "Ж".equals(block.type()))
                .toList();

            if ("composition".equals(normalizedStepId)) {
                boolean hasResidential = allBuildings.stream()
                    .anyMatch(b -> safe(b.category()).contains("residential"));
                if (!hasResidential) {
                    errors.add(buildValidationError(
                        "NO_RESIDENTIAL",
                        "Ошибка состава объектов",
                        "В проекте отсутствует жилой дом. Необходимо добавить хотя бы один объект типа \"Жилой дом\" или \"Многоблочный\".",
                        Map.of()
                    ));
                }
            }

            if ("registry_nonres".equals(normalizedStepId)) {
                for (BuildingData building : allBuildings) {
                    boolean isParking = "parking_separate".equals(building.category());
                    boolean isInfra = "infrastructure".equals(building.category());
                    boolean isUnderground = "underground".equals(building.parkingType()) || "underground".equals(building.constructionType());

                    List<BlockData> nonResBlocks = building.blocks().stream()
                        .filter(blk -> !"Ж".equals(blk.type()))
                        .filter(blk -> !blk.isBasementBlock())
                        .filter(blk -> !"BAS".equals(blk.type()))
                        .filter(blk -> !"ПД".equals(blk.type()))
                        .toList();

                    for (BlockData block : nonResBlocks) {
                        String title = getEntityTitle(building, block);
                        ConstructionData constr = block.construction();

                        if (isInfra) {
                            if (!isPositive(block.floorsCount())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Количество этажей\" обязательно", Map.of()));
                            if (!isPositive(block.entrancesCount())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Количество входов\" обязательно", Map.of()));
                            if (isBlank(constr.foundation())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Фундамент\" обязательно", Map.of()));
                            if (isBlank(constr.walls())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Материал стен\" обязательно", Map.of()));
                            if (isBlank(constr.slabs())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Перекрытия\" обязательно", Map.of()));
                            if (isBlank(constr.roof())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Кровля\" обязательно", Map.of()));
                            if (constr.seismicity() == null) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Сейсмичность\" обязательно", Map.of()));
                        } else if (isParking) {
                            if ("capital".equals(building.constructionType())) {
                                if (isBlank(constr.foundation())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Фундамент\" обязательно", Map.of()));
                                if (isBlank(constr.walls())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Материал стен\" обязательно", Map.of()));
                                if (isBlank(constr.slabs())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Перекрытия\" обязательно", Map.of()));
                                if (isBlank(constr.roof())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Кровля\" обязательно", Map.of()));
                                if (constr.seismicity() == null) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Сейсмичность\" обязательно", Map.of()));
                                if (!isPositive(block.vehicleEntries())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Въезды\" обязательно", Map.of()));
                                if (!isPositive(block.entrancesCount())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Количество входов\" обязательно", Map.of()));
                                if (isUnderground) {
                                    if (!isPositive(block.levelsDepth())) errors.add(buildValidationError("MISSING_FIELD", title, "Не указана глубина подземного паркинга.", Map.of()));
                                } else {
                                    if (!isPositive(block.floorsCount())) errors.add(buildValidationError("MISSING_FIELD", title, "Не указано количество этажей паркинга.", Map.of()));
                                }
                            } else if ("light".equals(building.constructionType())) {
                                if (isBlank(block.lightStructureType())) {
                                    errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Тип конструкции\" обязательно для легкого паркинга", Map.of()));
                                }
                            }
                        }
                    }
                }
            }

            if ("registry_res".equals(normalizedStepId)) {
                List<BuildingData> resBuildings = allBuildings.stream()
                    .filter(b -> safe(b.category()).contains("residential"))
                    .toList();

                for (BuildingData building : resBuildings) {
                    List<BlockData> blocks = building.blocks().stream().filter(blk -> "Ж".equals(blk.type())).toList();
                    if (blocks.isEmpty()) {
                        errors.add(buildValidationError("NO_BLOCKS", getEntityTitle(building, null), "Нет жилых блоков.", Map.of()));
                        continue;
                    }

                    for (BlockData block : blocks) {
                        String title = getEntityTitle(building, block);
                        ConstructionData constr = block.construction();
                        EngineeringData eng = block.engineering();

                        if (isBlank(constr.foundation())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Фундамент\" обязательно", Map.of()));
                        if (isBlank(constr.walls())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Материал стен\" обязательно", Map.of()));
                        if (isBlank(constr.slabs())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Перекрытия\" обязательно", Map.of()));
                        if (isBlank(constr.roof())) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Кровля\" обязательно", Map.of()));
                        if (constr.seismicity() == null) errors.add(buildValidationError("MISSING_FIELD", title, "Поле \"Сейсмичность\" обязательно", Map.of()));
                        if (!isPositive(block.entrancesCount())) errors.add(buildValidationError("MISSING_FIELD", title, "Не указано количество подъездов", Map.of()));
                        if (!isPositive(block.floorsFrom())) errors.add(buildValidationError("MISSING_FIELD", title, "Не указана \"Этажность (с)\"", Map.of()));
                        if (!isPositive(block.floorsTo())) errors.add(buildValidationError("MISSING_FIELD", title, "Не указана \"Этажность (по)\"", Map.of()));

                        int floorsToCheck = block.floorsTo() != null ? block.floorsTo() : 1;
                        if (floorsToCheck > 5 && (!isPositive(block.elevatorsCount()))) {
                            errors.add(buildValidationError("ELEVATOR_REQUIRED", title, "Здание выше 5 этажей (" + floorsToCheck + " эт.) обязано иметь хотя бы 1 лифт", Map.of()));
                        }

                        if (!eng.hasAnyTrue()) {
                            errors.add(buildValidationError("ENGINEERING_REQUIRED", title, "Не выбрана ни одна инженерная коммуникация", Map.of()));
                        }
                    }
                }
            }

            if ("basement_inventory".equals(normalizedStepId)) {
                for (BuildingData building : allBuildings) {
                    List<BlockData> basementBlocks = building.blocks().stream().filter(BlockData::isBasementBlock).toList();
                    for (BlockData block : basementBlocks) {
                        String title = getEntityTitle(building, block);
                        int depth = block.basementDepth() == null ? 1 : block.basementDepth();
                        if (depth < 1 || depth > 4) {
                            errors.add(buildValidationError("BASEMENT_DEPTH_INVALID", title, "Глубина подвала должна быть в диапазоне -1..-4.", Map.of()));
                        }

                        boolean hasCommShape = BASEMENT_COMM_KEYS.stream().allMatch(k -> block.basementCommunications().get(k) instanceof Boolean);
                        if (!hasCommShape) {
                            errors.add(buildValidationError("BASEMENT_COMM_REQUIRED", title, "Необходимо указать коммуникации подвала.", Map.of()));
                        }

                        List<String> links = block.linkedBlockIds().stream().map(String::trim).filter(s -> !s.isBlank()).toList();
                        if (links.isEmpty()) {
                            errors.add(buildValidationError(
                                "BASEMENT_LINKS_REQUIRED",
                                title,
                                "Для многоблочного жилого дома обязательно укажите, какие блоки обслуживает подвал.",
                                Map.of()
                            ));
                        }

                        for (Map.Entry<String, Object> entry : block.basementParkingLevels().entrySet()) {
                            int lvl = parseInt(entry.getKey(), Integer.MIN_VALUE);
                            if (lvl < 1 || lvl > depth) {
                                errors.add(buildValidationError("BASEMENT_PARKING_LEVEL_INVALID", title, "Уровни паркинга в подвале должны быть в диапазоне глубины подвала.", Map.of()));
                            }
                            if (!(entry.getValue() instanceof Boolean)) {
                                errors.add(buildValidationError("BASEMENT_PARKING_LEVEL_FLAG_INVALID", title, "Флаг активности уровня паркинга должен быть boolean.", Map.of()));
                            }
                        }
                    }
                }
            }

            if ("floors".equals(normalizedStepId)) {
                if (allBlocks.isEmpty()) {
                    errors.add(buildValidationError("NO_BLOCKS", "Матрица этажей", "В проекте отсутствуют блоки", Map.of()));
                } else {
                    List<UUID> blockIds = allBlocks.stream().map(BlockData::id).toList();
                    Map<UUID, List<FloorData>> floorsByBlock = fetchFloors(jdbcTemplate, blockIds).stream()
                        .collect(Collectors.groupingBy(FloorData::blockId));

                    for (BlockData block : allBlocks) {
                        BuildingData building = findBuildingByBlock(allBuildings, block.id());
                        String title = getEntityTitle(building, block);
                        List<FloorData> blockFloors = floorsByBlock.getOrDefault(block.id(), List.of());

                        if (blockFloors.isEmpty()) {
                            errors.add(buildValidationError("NO_FLOORS", title, "Нет данных об этажах. Заполните матрицу высот и площадей.", Map.of()));
                            continue;
                        }

                        for (FloorData floor : blockFloors) {
                            if (Boolean.TRUE.equals(floor.isStylobate()) || "stylobate".equals(floor.floorType())) {
                                continue;
                            }

                            String fLabel = !isBlank(floor.label()) ? floor.label() : floor.index() + " этаж";

                            if (!"roof".equals(floor.floorType())) {
                                if (floor.height() == null) {
                                    errors.add(buildValidationError("NO_HEIGHT", title, fLabel + ": Не указана высота.", Map.of()));
                                } else {
                                    double h = floor.height();
                                    if ("basement".equals(floor.floorType()) && (h < 1.8 || h > 4.0)) {
                                        errors.add(buildValidationError("BAD_HEIGHT", title, fLabel + ": Высота подвала должна быть 1.8-4.0 м.", Map.of()));
                                    } else if ("technical".equals(floor.floorType()) && (h < 1.5 || h > 6.0)) {
                                        errors.add(buildValidationError("BAD_HEIGHT", title, fLabel + ": Высота технического этажа должна быть 1.5-6.0 м.", Map.of()));
                                    } else if (!List.of("basement", "technical").contains(floor.floorType()) && (h < 2.0 || h > 6.0)) {
                                        errors.add(buildValidationError("BAD_HEIGHT", title, fLabel + ": Высота должна быть 2.0-6.0 м.", Map.of()));
                                    }
                                }
                            }

                            if (floor.areaProj() == null || floor.areaProj() <= 0) {
                                errors.add(buildValidationError("NO_AREA_PROJ", title, fLabel + ": Не указана проектная площадь.", Map.of()));
                            } else if (floor.areaFact() != null) {
                                double proj = floor.areaProj();
                                double fact = floor.areaFact();
                                if ((Math.abs(proj - fact) / proj) * 100 > 15) {
                                    errors.add(buildValidationError("AREA_DIFF", title, fLabel + ": Критическое расхождение S Проект/Факт (>15%). Уточните замеры.", Map.of()));
                                }
                            }
                        }
                    }
                }
            }

            if ("apartments".equals(normalizedStepId) && !residentialBlocks.isEmpty()) {
                List<UUID> blockIds = residentialBlocks.stream().map(BlockData::id).toList();
                List<FloorData> floors = fetchFloors(jdbcTemplate, blockIds);
                List<UUID> floorIds = floors.stream().map(FloorData::id).toList();

                if (!floorIds.isEmpty()) {
                    List<UnitData> units = fetchUnits(jdbcTemplate, floorIds);
                    Map<UUID, Map<String, Boolean>> unitsByBlock = new HashMap<>();
                    Map<UUID, FloorData> floorIndex = floors.stream().collect(Collectors.toMap(FloorData::id, f -> f));

                    for (UnitData unit : units) {
                        FloorData floor = floorIndex.get(unit.floorId());
                        if (floor == null) {
                            continue;
                        }
                        UUID blockId = floor.blockId();
                        unitsByBlock.computeIfAbsent(blockId, key -> new HashMap<>());

                        String num = safe(unit.number()).trim();
                        if (!num.isEmpty()) {
                            if (Boolean.TRUE.equals(unitsByBlock.get(blockId).get(num))) {
                                BlockData block = allBlocks.stream().filter(b -> b.id().equals(blockId)).findFirst().orElse(null);
                                BuildingData building = findBuildingByBlock(allBuildings, blockId);
                                String title = getEntityTitle(building, block);
                                errors.add(buildValidationError("DUPLICATE_UNIT", title, "Дубликаты номеров: обнаружен повторяющийся номер квартиры: \"" + num + "\".", Map.of()));
                            }
                            unitsByBlock.get(blockId).put(num, true);
                        }
                    }
                } else {
                    errors.add(buildValidationError("FLOORS_REQUIRED", "Помещения", "Сначала заполните этажи для жилых блоков", Map.of()));
                }
            }

            if ("entrances".equals(normalizedStepId)) {
                for (BlockData block : residentialBlocks) {
                    if (!isPositive(block.entrancesCount())) {
                        BuildingData building = findBuildingByBlock(allBuildings, block.id());
                        String title = getEntityTitle(building, block);
                        errors.add(buildValidationError("ENTRANCES_REQUIRED", title, "Для жилого блока отсутствуют подъезды", Map.of("blockId", block.id())));
                    }
                }
            }

            return new ValidationResult(true, null, null, null, errors);
        } catch (Exception ex) {
            return new ValidationResult(false, 500, "DB_ERROR", ex.getMessage(), List.of());
        }
    }

    private static List<BuildingData> fetchBuildingsWithBlocks(JdbcTemplate jdbcTemplate, UUID projectId) {
        List<Map<String, Object>> buildingRows = jdbcTemplate.queryForList("""
            select id, label, building_code, house_number, category, construction_type, parking_type, infra_type, has_non_res_part
            from buildings
            where project_id = ?
        """, projectId);

        List<Map<String, Object>> blockRows = jdbcTemplate.queryForList("""
            select bb.id, bb.building_id, bb.label, bb.type, bb.floors_from, bb.floors_to, bb.floors_count, bb.entrances_count,
                   bb.elevators_count, bb.levels_depth, bb.vehicle_entries, bb.light_structure_type,
                   bb.is_basement_block, bb.linked_block_ids, bb.basement_depth, bb.basement_has_parking,
                   bb.basement_parking_levels, bb.basement_communications,
                   bc.foundation, bc.walls, bc.slabs, bc.roof, bc.seismicity,
                   be.has_electricity, be.has_water, be.has_hot_water, be.has_sewerage, be.has_gas,
                   be.has_heating_local, be.has_heating_central, be.has_ventilation, be.has_firefighting,
                   be.has_lowcurrent, be.has_internet, be.has_solar_panels
            from building_blocks bb
            left join block_construction bc on bc.block_id = bb.id
            left join block_engineering be on be.block_id = bb.id
            where bb.building_id in (
                select id from buildings where project_id = ?
            )
        """, projectId);

        Map<UUID, List<BlockData>> blocksByBuilding = new LinkedHashMap<>();
        for (Map<String, Object> row : blockRows) {
            UUID buildingId = castUuid(row.get("building_id"));
            blocksByBuilding.computeIfAbsent(buildingId, k -> new ArrayList<>()).add(mapBlockRow(row));
        }

        List<BuildingData> buildings = new ArrayList<>();
        for (Map<String, Object> row : buildingRows) {
            UUID id = castUuid(row.get("id"));
            buildings.add(new BuildingData(
                id,
                asString(row.get("label")),
                asString(row.get("building_code")),
                asString(row.get("house_number")),
                asString(row.get("category")),
                asString(row.get("construction_type")),
                asString(row.get("parking_type")),
                asString(row.get("infra_type")),
                asBoolean(row.get("has_non_res_part")),
                blocksByBuilding.getOrDefault(id, List.of())
            ));
        }

        return buildings;
    }

    private static BlockData mapBlockRow(Map<String, Object> row) {
        return new BlockData(
            castUuid(row.get("id")),
            asString(row.get("label")),
            asString(row.get("type")),
            asInteger(row.get("floors_from")),
            asInteger(row.get("floors_to")),
            asInteger(row.get("floors_count")),
            asInteger(row.get("entrances_count")),
            asInteger(row.get("elevators_count")),
            asInteger(row.get("levels_depth")),
            asInteger(row.get("vehicle_entries")),
            asString(row.get("light_structure_type")),
            asBoolean(row.get("is_basement_block")),
            parseStringList(row.get("linked_block_ids")),
            asInteger(row.get("basement_depth")),
            asBoolean(row.get("basement_has_parking")),
            parseObjectMap(row.get("basement_parking_levels")),
            parseObjectMap(row.get("basement_communications")),
            new ConstructionData(
                asString(row.get("foundation")),
                asString(row.get("walls")),
                asString(row.get("slabs")),
                asString(row.get("roof")),
                asInteger(row.get("seismicity"))
            ),
            new EngineeringData(
                asBoolean(row.get("has_electricity")),
                asBoolean(row.get("has_water")),
                asBoolean(row.get("has_hot_water")),
                asBoolean(row.get("has_sewerage")),
                asBoolean(row.get("has_gas")),
                asBoolean(row.get("has_heating_local")),
                asBoolean(row.get("has_heating_central")),
                asBoolean(row.get("has_ventilation")),
                asBoolean(row.get("has_firefighting")),
                asBoolean(row.get("has_lowcurrent")),
                asBoolean(row.get("has_internet")),
                asBoolean(row.get("has_solar_panels"))
            )
        );
    }

    private static List<FloorData> fetchFloors(JdbcTemplate jdbcTemplate, List<UUID> blockIds) {
        if (blockIds.isEmpty()) {
            return List.of();
        }

        String sql = """
            select id, block_id, label, "index" as floor_index, floor_type, is_stylobate, height, area_proj, area_fact
            from floors
            where block_id in (%s)
        """.formatted(blockIds.stream().map(id -> "?").collect(Collectors.joining(",")));

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, blockIds.toArray());
        return rows.stream().map(row -> new FloorData(
            castUuid(row.get("id")),
            castUuid(row.get("block_id")),
            asString(row.get("label")),
            asInteger(row.get("floor_index")),
            asString(row.get("floor_type")),
            asBoolean(row.get("is_stylobate")),
            asDouble(row.get("height")),
            asDouble(row.get("area_proj")),
            asDouble(row.get("area_fact"))
        )).toList();
    }

    private static List<UnitData> fetchUnits(JdbcTemplate jdbcTemplate, List<UUID> floorIds) {
        if (floorIds.isEmpty()) {
            return List.of();
        }

        String sql = """
            select id, floor_id, number
            from units
            where floor_id in (%s)
        """.formatted(floorIds.stream().map(id -> "?").collect(Collectors.joining(",")));

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, floorIds.toArray());
        return rows.stream()
            .map(row -> new UnitData(castUuid(row.get("id")), castUuid(row.get("floor_id")), asString(row.get("number"))))
            .toList();
    }

    private static BuildingData findBuildingByBlock(List<BuildingData> buildings, UUID blockId) {
        for (BuildingData building : buildings) {
            boolean hasBlock = building.blocks().stream().anyMatch(block -> block.id().equals(blockId));
            if (hasBlock) {
                return building;
            }
        }
        return null;
    }

    private static List<String> parseStringList(Object value) {
        if (value == null) {
            return List.of();
        }

        if (value instanceof Array arrayValue) {
            try {
                Object arr = arrayValue.getArray();
                if (arr instanceof Object[] raw) {
                    List<String> list = new ArrayList<>();
                    for (Object item : raw) {
                        if (item != null) {
                            list.add(String.valueOf(item));
                        }
                    }
                    return list;
                }
            } catch (SQLException ignored) {
                return List.of();
            }
        }

        String raw = extractJsonOrText(value);
        if (raw == null || raw.isBlank() || "{}".equals(raw) || "[]".equals(raw)) {
            return List.of();
        }

        try {
            return OBJECT_MAPPER.readValue(raw, new TypeReference<List<String>>() {
            });
        } catch (Exception ignored) {
            return List.of();
        }
    }

    private static Map<String, Object> parseObjectMap(Object value) {
        String raw = extractJsonOrText(value);
        if (raw == null || raw.isBlank() || "{}".equals(raw)) {
            return new LinkedHashMap<>();
        }

        try {
            return OBJECT_MAPPER.readValue(raw, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception ignored) {
            return new LinkedHashMap<>();
        }
    }

    private static String extractJsonOrText(Object value) {
        if (value == null) {
            return null;
        }
        if (value != null && "org.postgresql.util.PGobject".equals(value.getClass().getName())) {
            try {
                return String.valueOf(value.getClass().getMethod("getValue").invoke(value));
            } catch (Exception ignored) {
                return String.valueOf(value);
            }
        }
        return String.valueOf(value);
    }

    private static boolean isPositive(Integer value) {
        return value != null && value > 0;
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static Integer asInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number n) {
            return n.intValue();
        }
        return parseInt(String.valueOf(value), null);
    }

    private static Double asDouble(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static Boolean asBoolean(Object value) {
        if (value == null) {
            return false;
        }
        if (value instanceof Boolean b) {
            return b;
        }
        return "true".equalsIgnoreCase(String.valueOf(value));
    }

    private static UUID castUuid(Object value) {
        if (value instanceof UUID uuid) {
            return uuid;
        }
        return UUID.fromString(String.valueOf(value));
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String safe(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private static int parseInt(String value, Integer fallback) {
        try {
            return Integer.parseInt(Objects.requireNonNullElse(value, ""));
        } catch (Exception ex) {
            return fallback == null ? 0 : fallback;
        }
    }

    public record ValidationError(String code, String title, String message, Map<String, Object> meta) {
    }

    public record ValidationResult(boolean ok, Integer status, String code, String message, List<ValidationError> errors) {
    }

    public record BuildingData(
        UUID id,
        String label,
        String buildingCode,
        String houseNumber,
        String category,
        String constructionType,
        String parkingType,
        String infraType,
        boolean hasNonResPart,
        List<BlockData> blocks
    ) {
    }

    public record BlockData(
        UUID id,
        String label,
        String type,
        Integer floorsFrom,
        Integer floorsTo,
        Integer floorsCount,
        Integer entrancesCount,
        Integer elevatorsCount,
        Integer levelsDepth,
        Integer vehicleEntries,
        String lightStructureType,
        boolean isBasementBlock,
        List<String> linkedBlockIds,
        Integer basementDepth,
        boolean basementHasParking,
        Map<String, Object> basementParkingLevels,
        Map<String, Object> basementCommunications,
        ConstructionData construction,
        EngineeringData engineering
    ) {
    }

    public record ConstructionData(
        String foundation,
        String walls,
        String slabs,
        String roof,
        Integer seismicity
    ) {
    }

    public record EngineeringData(
        boolean hasElectricity,
        boolean hasWater,
        boolean hasHotWater,
        boolean hasSewerage,
        boolean hasGas,
        boolean hasHeatingLocal,
        boolean hasHeatingCentral,
        boolean hasVentilation,
        boolean hasFirefighting,
        boolean hasLowcurrent,
        boolean hasInternet,
        boolean hasSolarPanels
    ) {
        public boolean hasAnyTrue() {
            return hasElectricity || hasWater || hasHotWater || hasSewerage || hasGas
                || hasHeatingLocal || hasHeatingCentral || hasVentilation || hasFirefighting
                || hasLowcurrent || hasInternet || hasSolarPanels;
        }
    }

    public record FloorData(
        UUID id,
        UUID blockId,
        String label,
        Integer index,
        String floorType,
        Boolean isStylobate,
        Double height,
        Double areaProj,
        Double areaFact
    ) {
    }

    public record UnitData(UUID id, UUID floorId, String number) {
    }
}
