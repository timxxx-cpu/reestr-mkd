package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.BlockConstructionEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockEngineeringEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockConstructionJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BlockEngineeringJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RegistryValidationService {

    private static final List<String> BASEMENT_COMM_KEYS = List.of(
        "electricity", "water", "sewerage", "heating", "ventilation", "gas", "firefighting"
    );

    private final BuildingJpaRepository buildingJpaRepository;
    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final BlockConstructionJpaRepository blockConstructionJpaRepository;
    private final BlockEngineeringJpaRepository blockEngineeringJpaRepository;
    private final FloorJpaRepository floorJpaRepository;
    private final UnitJpaRepository unitJpaRepository;

    public RegistryValidationService(
        BuildingJpaRepository buildingJpaRepository,
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        BlockConstructionJpaRepository blockConstructionJpaRepository,
        BlockEngineeringJpaRepository blockEngineeringJpaRepository,
        FloorJpaRepository floorJpaRepository,
        UnitJpaRepository unitJpaRepository
    ) {
        this.buildingJpaRepository = buildingJpaRepository;
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.blockConstructionJpaRepository = blockConstructionJpaRepository;
        this.blockEngineeringJpaRepository = blockEngineeringJpaRepository;
        this.floorJpaRepository = floorJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
    }

    public ValidationUtils.ValidationResult buildStepValidationResult(UUID projectId, String stepId) {
        String normalizedStepId = stepId == null ? "" : stepId.trim();
        List<ValidationUtils.ValidationError> errors = new ArrayList<>();

        try {
            List<ValidationUtils.BuildingData> allBuildings = fetchBuildingsWithBlocks(projectId);
            List<ValidationUtils.BlockData> allBlocks = allBuildings.stream()
                .flatMap(building -> building.blocks().stream())
                .toList();
            List<ValidationUtils.BlockData> residentialBlocks = allBlocks.stream()
                .filter(block -> "Р–".equals(block.type()))
                .toList();

            if ("composition".equals(normalizedStepId)) {
                validateComposition(allBuildings, errors);
            }
            if ("registry_nonres".equals(normalizedStepId)) {
                validateNonResidential(allBuildings, errors);
            }
            if ("registry_res".equals(normalizedStepId)) {
                validateResidential(allBuildings, errors);
            }
            if ("basement_inventory".equals(normalizedStepId)) {
                validateBasements(allBuildings, errors);
            }
            if ("floors".equals(normalizedStepId)) {
                validateFloors(allBuildings, allBlocks, errors);
            }
            if ("apartments".equals(normalizedStepId) && !residentialBlocks.isEmpty()) {
                validateApartments(allBuildings, allBlocks, residentialBlocks, errors);
            }
            if ("entrances".equals(normalizedStepId)) {
                validateEntrances(allBuildings, residentialBlocks, errors);
            }

            return new ValidationUtils.ValidationResult(true, null, null, null, errors);
        } catch (Exception ex) {
            return new ValidationUtils.ValidationResult(false, 500, "DB_ERROR", ex.getMessage(), List.of());
        }
    }

    private void validateComposition(List<ValidationUtils.BuildingData> allBuildings, List<ValidationUtils.ValidationError> errors) {
        boolean hasResidential = allBuildings.stream()
            .anyMatch(building -> safe(building.category()).contains("residential"));
        if (!hasResidential) {
            errors.add(ValidationUtils.buildValidationError(
                "NO_RESIDENTIAL",
                "РћС€РёР±РєР° СЃРѕСЃС‚Р°РІР° РѕР±СЉРµРєС‚РѕРІ",
                "Р’ РїСЂРѕРµРєС‚Рµ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚ Р¶РёР»РѕР№ РґРѕРј. РќРµРѕР±С…РѕРґРёРјРѕ РґРѕР±Р°РІРёС‚СЊ С…РѕС‚СЏ Р±С‹ РѕРґРёРЅ РѕР±СЉРµРєС‚ С‚РёРїР° \"Р–РёР»РѕР№ РґРѕРј\" РёР»Рё \"РњРЅРѕРіРѕР±Р»РѕС‡РЅС‹Р№\".",
                Map.of()
            ));
        }
    }

    private void validateNonResidential(List<ValidationUtils.BuildingData> allBuildings, List<ValidationUtils.ValidationError> errors) {
        for (ValidationUtils.BuildingData building : allBuildings) {
            boolean isParking = "parking_separate".equals(building.category());
            boolean isInfra = "infrastructure".equals(building.category());
            boolean isUnderground = "underground".equals(building.parkingType()) || "underground".equals(building.constructionType());

            List<ValidationUtils.BlockData> nonResBlocks = building.blocks().stream()
                .filter(block -> !"Р–".equals(block.type()))
                .filter(block -> !block.isBasementBlock())
                .filter(block -> !"BAS".equals(block.type()))
                .filter(block -> !"РџР”".equals(block.type()))
                .toList();

            for (ValidationUtils.BlockData block : nonResBlocks) {
                String title = ValidationUtils.getEntityTitle(building, block);
                ValidationUtils.ConstructionData constr = block.construction();

                if (isInfra) {
                    if (!isPositive(block.floorsCount())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РљРѕР»РёС‡РµСЃС‚РІРѕ СЌС‚Р°Р¶РµР№\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                    if (!isPositive(block.entrancesCount())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РљРѕР»РёС‡РµСЃС‚РІРѕ РІС…РѕРґРѕРІ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                    if (isBlank(constr.foundation())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"Р¤СѓРЅРґР°РјРµРЅС‚\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                    if (isBlank(constr.walls())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РњР°С‚РµСЂРёР°Р» СЃС‚РµРЅ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                    if (isBlank(constr.slabs())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РџРµСЂРµРєСЂС‹С‚РёСЏ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                    if (isBlank(constr.roof())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РљСЂРѕРІР»СЏ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                    if (constr.seismicity() == null) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РЎРµР№СЃРјРёС‡РЅРѕСЃС‚СЊ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                } else if (isParking) {
                    if ("capital".equals(building.constructionType())) {
                        if (isBlank(constr.foundation())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"Р¤СѓРЅРґР°РјРµРЅС‚\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                        if (isBlank(constr.walls())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РњР°С‚РµСЂРёР°Р» СЃС‚РµРЅ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                        if (isBlank(constr.slabs())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РџРµСЂРµРєСЂС‹С‚РёСЏ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                        if (isBlank(constr.roof())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РљСЂРѕРІР»СЏ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                        if (constr.seismicity() == null) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РЎРµР№СЃРјРёС‡РЅРѕСЃС‚СЊ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                        if (!isPositive(block.vehicleEntries())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"Р’СЉРµР·РґС‹\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                        if (!isPositive(block.entrancesCount())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РљРѕР»РёС‡РµСЃС‚РІРѕ РІС…РѕРґРѕРІ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                        if (isUnderground) {
                            if (!isPositive(block.levelsDepth())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РќРµ СѓРєР°Р·Р°РЅР° РіР»СѓР±РёРЅР° РїРѕРґР·РµРјРЅРѕРіРѕ РїР°СЂРєРёРЅРіР°.", Map.of()));
                        } else {
                            if (!isPositive(block.floorsCount())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РќРµ СѓРєР°Р·Р°РЅРѕ РєРѕР»РёС‡РµСЃС‚РІРѕ СЌС‚Р°Р¶РµР№ РїР°СЂРєРёРЅРіР°.", Map.of()));
                        }
                    } else if ("light".equals(building.constructionType()) && isBlank(block.lightStructureType())) {
                        errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РўРёРї РєРѕРЅСЃС‚СЂСѓРєС†РёРё\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ РґР»СЏ Р»РµРіРєРѕРіРѕ РїР°СЂРєРёРЅРіР°", Map.of()));
                    }
                }
            }
        }
    }

    private void validateResidential(List<ValidationUtils.BuildingData> allBuildings, List<ValidationUtils.ValidationError> errors) {
        List<ValidationUtils.BuildingData> residentialBuildings = allBuildings.stream()
            .filter(building -> safe(building.category()).contains("residential"))
            .toList();

        for (ValidationUtils.BuildingData building : residentialBuildings) {
            List<ValidationUtils.BlockData> blocks = building.blocks().stream()
                .filter(block -> "Р–".equals(block.type()))
                .toList();
            if (blocks.isEmpty()) {
                errors.add(ValidationUtils.buildValidationError("NO_BLOCKS", ValidationUtils.getEntityTitle(building, null), "РќРµС‚ Р¶РёР»С‹С… Р±Р»РѕРєРѕРІ.", Map.of()));
                continue;
            }

            for (ValidationUtils.BlockData block : blocks) {
                String title = ValidationUtils.getEntityTitle(building, block);
                ValidationUtils.ConstructionData constr = block.construction();
                ValidationUtils.EngineeringData eng = block.engineering();

                if (isBlank(constr.foundation())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"Р¤СѓРЅРґР°РјРµРЅС‚\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                if (isBlank(constr.walls())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РњР°С‚РµСЂРёР°Р» СЃС‚РµРЅ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                if (isBlank(constr.slabs())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РџРµСЂРµРєСЂС‹С‚РёСЏ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                if (isBlank(constr.roof())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РљСЂРѕРІР»СЏ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                if (constr.seismicity() == null) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РџРѕР»Рµ \"РЎРµР№СЃРјРёС‡РЅРѕСЃС‚СЊ\" РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ", Map.of()));
                if (!isPositive(block.entrancesCount())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РќРµ СѓРєР°Р·Р°РЅРѕ РєРѕР»РёС‡РµСЃС‚РІРѕ РїРѕРґСЉРµР·РґРѕРІ", Map.of()));
                if (!isPositive(block.floorsFrom())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РќРµ СѓРєР°Р·Р°РЅР° \"Р­С‚Р°Р¶РЅРѕСЃС‚СЊ (СЃ)\"", Map.of()));
                if (!isPositive(block.floorsTo())) errors.add(ValidationUtils.buildValidationError("MISSING_FIELD", title, "РќРµ СѓРєР°Р·Р°РЅР° \"Р­С‚Р°Р¶РЅРѕСЃС‚СЊ (РїРѕ)\"", Map.of()));

                int floorsToCheck = block.floorsTo() != null ? block.floorsTo() : 1;
                if (floorsToCheck > 5 && (!isPositive(block.elevatorsCount()))) {
                    errors.add(ValidationUtils.buildValidationError("ELEVATOR_REQUIRED", title, "Р—РґР°РЅРёРµ РІС‹С€Рµ 5 СЌС‚Р°Р¶РµР№ (" + floorsToCheck + " СЌС‚.) РѕР±СЏР·Р°РЅРѕ РёРјРµС‚СЊ С…РѕС‚СЏ Р±С‹ 1 Р»РёС„С‚", Map.of()));
                }

                if (!eng.hasAnyTrue()) {
                    errors.add(ValidationUtils.buildValidationError("ENGINEERING_REQUIRED", title, "РќРµ РІС‹Р±СЂР°РЅР° РЅРё РѕРґРЅР° РёРЅР¶РµРЅРµСЂРЅР°СЏ РєРѕРјРјСѓРЅРёРєР°С†РёСЏ", Map.of()));
                }
            }
        }
    }

    private void validateBasements(List<ValidationUtils.BuildingData> allBuildings, List<ValidationUtils.ValidationError> errors) {
        for (ValidationUtils.BuildingData building : allBuildings) {
            List<ValidationUtils.BlockData> basementBlocks = building.blocks().stream()
                .filter(ValidationUtils.BlockData::isBasementBlock)
                .toList();
            for (ValidationUtils.BlockData block : basementBlocks) {
                String title = ValidationUtils.getEntityTitle(building, block);
                int depth = block.basementDepth() == null ? 1 : block.basementDepth();
                if (depth < 1 || depth > 4) {
                    errors.add(ValidationUtils.buildValidationError("BASEMENT_DEPTH_INVALID", title, "Р“Р»СѓР±РёРЅР° РїРѕРґРІР°Р»Р° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РІ РґРёР°РїР°Р·РѕРЅРµ -1..-4.", Map.of()));
                }

                boolean hasCommShape = BASEMENT_COMM_KEYS.stream().allMatch(key -> block.basementCommunications().get(key) instanceof Boolean);
                if (!hasCommShape) {
                    errors.add(ValidationUtils.buildValidationError("BASEMENT_COMM_REQUIRED", title, "РќРµРѕР±С…РѕРґРёРјРѕ СѓРєР°Р·Р°С‚СЊ РєРѕРјРјСѓРЅРёРєР°С†РёРё РїРѕРґРІР°Р»Р°.", Map.of()));
                }

                List<String> links = block.linkedBlockIds().stream()
                    .map(String::trim)
                    .filter(value -> !value.isBlank())
                    .toList();
                if (links.isEmpty()) {
                    errors.add(ValidationUtils.buildValidationError(
                        "BASEMENT_LINKS_REQUIRED",
                        title,
                        "Р”Р»СЏ РјРЅРѕРіРѕР±Р»РѕС‡РЅРѕРіРѕ Р¶РёР»РѕРіРѕ РґРѕРјР° РѕР±СЏР·Р°С‚РµР»СЊРЅРѕ СѓРєР°Р¶РёС‚Рµ, РєР°РєРёРµ Р±Р»РѕРєРё РѕР±СЃР»СѓР¶РёРІР°РµС‚ РїРѕРґРІР°Р».",
                        Map.of()
                    ));
                }

                for (Map.Entry<String, Object> entry : block.basementParkingLevels().entrySet()) {
                    int lvl = parseInt(entry.getKey(), Integer.MIN_VALUE);
                    if (lvl < 1 || lvl > depth) {
                        errors.add(ValidationUtils.buildValidationError("BASEMENT_PARKING_LEVEL_INVALID", title, "РЈСЂРѕРІРЅРё РїР°СЂРєРёРЅРіР° РІ РїРѕРґРІР°Р»Рµ РґРѕР»Р¶РЅС‹ Р±С‹С‚СЊ РІ РґРёР°РїР°Р·РѕРЅРµ РіР»СѓР±РёРЅС‹ РїРѕРґРІР°Р»Р°.", Map.of()));
                    }
                    if (!(entry.getValue() instanceof Boolean)) {
                        errors.add(ValidationUtils.buildValidationError("BASEMENT_PARKING_LEVEL_FLAG_INVALID", title, "Р¤Р»Р°Рі Р°РєС‚РёРІРЅРѕСЃС‚Рё СѓСЂРѕРІРЅСЏ РїР°СЂРєРёРЅРіР° РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ boolean.", Map.of()));
                    }
                }
            }
        }
    }

    private void validateFloors(
        List<ValidationUtils.BuildingData> allBuildings,
        List<ValidationUtils.BlockData> allBlocks,
        List<ValidationUtils.ValidationError> errors
    ) {
        if (allBlocks.isEmpty()) {
            errors.add(ValidationUtils.buildValidationError("NO_BLOCKS", "РњР°С‚СЂРёС†Р° СЌС‚Р°Р¶РµР№", "Р’ РїСЂРѕРµРєС‚Рµ РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚ Р±Р»РѕРєРё", Map.of()));
            return;
        }

        List<UUID> blockIds = allBlocks.stream().map(ValidationUtils.BlockData::id).toList();
        Map<UUID, List<ValidationUtils.FloorData>> floorsByBlock = fetchFloors(blockIds).stream()
            .collect(Collectors.groupingBy(ValidationUtils.FloorData::blockId));

        for (ValidationUtils.BlockData block : allBlocks) {
            ValidationUtils.BuildingData building = findBuildingByBlock(allBuildings, block.id());
            String title = ValidationUtils.getEntityTitle(building, block);
            List<ValidationUtils.FloorData> blockFloors = floorsByBlock.getOrDefault(block.id(), List.of());
            if (blockFloors.isEmpty()) {
                errors.add(ValidationUtils.buildValidationError("NO_FLOORS", title, "РќРµС‚ РґР°РЅРЅС‹С… РѕР± СЌС‚Р°Р¶Р°С…. Р—Р°РїРѕР»РЅРёС‚Рµ РјР°С‚СЂРёС†Сѓ РІС‹СЃРѕС‚ Рё РїР»РѕС‰Р°РґРµР№.", Map.of()));
                continue;
            }

            for (ValidationUtils.FloorData floor : blockFloors) {
                if (Boolean.TRUE.equals(floor.isStylobate()) || "stylobate".equals(floor.floorType())) {
                    continue;
                }

                String floorLabel = !isBlank(floor.label()) ? floor.label() : floor.index() + " СЌС‚Р°Р¶";
                if (!"roof".equals(floor.floorType())) {
                    if (floor.height() == null) {
                        errors.add(ValidationUtils.buildValidationError("NO_HEIGHT", title, floorLabel + ": РќРµ СѓРєР°Р·Р°РЅР° РІС‹СЃРѕС‚Р°.", Map.of()));
                    } else {
                        double height = floor.height();
                        if ("basement".equals(floor.floorType()) && (height < 1.8 || height > 4.0)) {
                            errors.add(ValidationUtils.buildValidationError("BAD_HEIGHT", title, floorLabel + ": Р’С‹СЃРѕС‚Р° РїРѕРґРІР°Р»Р° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ 1.8-4.0 Рј.", Map.of()));
                        } else if ("technical".equals(floor.floorType()) && (height < 1.5 || height > 6.0)) {
                            errors.add(ValidationUtils.buildValidationError("BAD_HEIGHT", title, floorLabel + ": Р’С‹СЃРѕС‚Р° С‚РµС…РЅРёС‡РµСЃРєРѕРіРѕ СЌС‚Р°Р¶Р° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ 1.5-6.0 Рј.", Map.of()));
                        } else if (!List.of("basement", "technical").contains(floor.floorType()) && (height < 2.0 || height > 6.0)) {
                            errors.add(ValidationUtils.buildValidationError("BAD_HEIGHT", title, floorLabel + ": Р’С‹СЃРѕС‚Р° РґРѕР»Р¶РЅР° Р±С‹С‚СЊ 2.0-6.0 Рј.", Map.of()));
                        }
                    }
                }

                if (floor.areaProj() == null || floor.areaProj() <= 0) {
                    errors.add(ValidationUtils.buildValidationError("NO_AREA_PROJ", title, floorLabel + ": РќРµ СѓРєР°Р·Р°РЅР° РїСЂРѕРµРєС‚РЅР°СЏ РїР»РѕС‰Р°РґСЊ.", Map.of()));
                } else if (floor.areaFact() != null) {
                    double areaProj = floor.areaProj();
                    double areaFact = floor.areaFact();
                    if ((Math.abs(areaProj - areaFact) / areaProj) * 100 > 15) {
                        errors.add(ValidationUtils.buildValidationError("AREA_DIFF", title, floorLabel + ": РљСЂРёС‚РёС‡РµСЃРєРѕРµ СЂР°СЃС…РѕР¶РґРµРЅРёРµ S РџСЂРѕРµРєС‚/Р¤Р°РєС‚ (>15%). РЈС‚РѕС‡РЅРёС‚Рµ Р·Р°РјРµСЂС‹.", Map.of()));
                    }
                }
            }
        }
    }

    private void validateApartments(
        List<ValidationUtils.BuildingData> allBuildings,
        List<ValidationUtils.BlockData> allBlocks,
        List<ValidationUtils.BlockData> residentialBlocks,
        List<ValidationUtils.ValidationError> errors
    ) {
        List<UUID> blockIds = residentialBlocks.stream().map(ValidationUtils.BlockData::id).toList();
        List<ValidationUtils.FloorData> floors = fetchFloors(blockIds);
        List<UUID> floorIds = floors.stream().map(ValidationUtils.FloorData::id).toList();
        if (floorIds.isEmpty()) {
            errors.add(ValidationUtils.buildValidationError("FLOORS_REQUIRED", "РџРѕРјРµС‰РµРЅРёСЏ", "РЎРЅР°С‡Р°Р»Р° Р·Р°РїРѕР»РЅРёС‚Рµ СЌС‚Р°Р¶Рё РґР»СЏ Р¶РёР»С‹С… Р±Р»РѕРєРѕРІ", Map.of()));
            return;
        }

        List<ValidationUtils.UnitData> units = fetchUnits(floorIds);
        Map<UUID, Map<String, Boolean>> unitsByBlock = new HashMap<>();
        Map<UUID, ValidationUtils.FloorData> floorIndex = floors.stream()
            .collect(Collectors.toMap(ValidationUtils.FloorData::id, floor -> floor));

        for (ValidationUtils.UnitData unit : units) {
            ValidationUtils.FloorData floor = floorIndex.get(unit.floorId());
            if (floor == null) {
                continue;
            }
            UUID blockId = floor.blockId();
            unitsByBlock.computeIfAbsent(blockId, ignored -> new HashMap<>());

            String number = safe(unit.number()).trim();
            if (!number.isEmpty()) {
                if (Boolean.TRUE.equals(unitsByBlock.get(blockId).get(number))) {
                    ValidationUtils.BlockData block = allBlocks.stream().filter(item -> item.id().equals(blockId)).findFirst().orElse(null);
                    ValidationUtils.BuildingData building = findBuildingByBlock(allBuildings, blockId);
                    String title = ValidationUtils.getEntityTitle(building, block);
                    errors.add(ValidationUtils.buildValidationError("DUPLICATE_UNIT", title, "Р”СѓР±Р»РёРєР°С‚С‹ РЅРѕРјРµСЂРѕРІ: РѕР±РЅР°СЂСѓР¶РµРЅ РїРѕРІС‚РѕСЂСЏСЋС‰РёР№СЃСЏ РЅРѕРјРµСЂ РєРІР°СЂС‚РёСЂС‹: \"" + number + "\".", Map.of()));
                }
                unitsByBlock.get(blockId).put(number, true);
            }
        }

        Map<UUID, Long> duplexUnitsByFloor = units.stream()
            .filter(unit -> isDuplexUnitType(unit.unitType()))
            .collect(Collectors.groupingBy(ValidationUtils.UnitData::floorId, Collectors.counting()));

        for (ValidationUtils.FloorData floor : floors) {
            if (!Boolean.TRUE.equals(floor.isDuplex())) {
                continue;
            }

            long duplexCount = duplexUnitsByFloor.getOrDefault(floor.id(), 0L);
            if (duplexCount > 0) {
                continue;
            }

            UUID blockId = floor.blockId();
            ValidationUtils.BlockData block = allBlocks.stream().filter(item -> item.id().equals(blockId)).findFirst().orElse(null);
            ValidationUtils.BuildingData building = findBuildingByBlock(allBuildings, blockId);
            String title = ValidationUtils.getEntityTitle(building, block);
            String floorLabel = !isBlank(floor.label()) ? floor.label() : (floor.index() != null ? floor.index() + " СЌС‚Р°Р¶" : "СЌС‚Р°Р¶");
            errors.add(ValidationUtils.buildValidationError(
                "DUPLEX_UNITS_REQUIRED",
                title,
                floorLabel + ": Р­С‚Р°Р¶ РѕС‚РјРµС‡РµРЅ РєР°Рє \"Р”СѓРїР»РµРєСЃ\", РЅРѕ РґСѓРїР»РµРєСЃ-РєРІР°СЂС‚РёСЂС‹ РЅРµ РЅР°Р·РЅР°С‡РµРЅС‹.",
                Map.of("floorId", floor.id(), "blockId", floor.blockId())
            ));
        }
    }

    private void validateEntrances(
        List<ValidationUtils.BuildingData> allBuildings,
        List<ValidationUtils.BlockData> residentialBlocks,
        List<ValidationUtils.ValidationError> errors
    ) {
        for (ValidationUtils.BlockData block : residentialBlocks) {
            if (!isPositive(block.entrancesCount())) {
                ValidationUtils.BuildingData building = findBuildingByBlock(allBuildings, block.id());
                String title = ValidationUtils.getEntityTitle(building, block);
                errors.add(ValidationUtils.buildValidationError("ENTRANCES_REQUIRED", title, "Р”Р»СЏ Р¶РёР»РѕРіРѕ Р±Р»РѕРєР° РѕС‚СЃСѓС‚СЃС‚РІСѓСЋС‚ РїРѕРґСЉРµР·РґС‹", Map.of("blockId", block.id())));
            }
        }
    }

    private List<ValidationUtils.BuildingData> fetchBuildingsWithBlocks(UUID projectId) {
        List<BuildingEntity> buildings = buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
        if (buildings.isEmpty()) {
            return List.of();
        }

        List<UUID> buildingIds = buildings.stream().map(BuildingEntity::getId).filter(Objects::nonNull).toList();
        List<BuildingBlockEntity> blocks = buildingBlockJpaRepository.findByBuildingIdIn(buildingIds);
        List<UUID> blockIds = blocks.stream().map(BuildingBlockEntity::getId).filter(Objects::nonNull).toList();

        Map<UUID, BlockConstructionEntity> constructionByBlock = blockConstructionJpaRepository.findByBlockIdIn(blockIds).stream()
            .filter(entity -> entity.getBlockId() != null)
            .collect(Collectors.toMap(BlockConstructionEntity::getBlockId, entity -> entity, (left, right) -> left));
        Map<UUID, BlockEngineeringEntity> engineeringByBlock = blockEngineeringJpaRepository.findByBlockIdIn(blockIds).stream()
            .filter(entity -> entity.getBlockId() != null)
            .collect(Collectors.toMap(BlockEngineeringEntity::getBlockId, entity -> entity, (left, right) -> left));

        Map<UUID, List<ValidationUtils.BlockData>> blocksByBuilding = new LinkedHashMap<>();
        for (BuildingBlockEntity block : blocks) {
            UUID buildingId = block.getBuildingId();
            if (buildingId == null) {
                continue;
            }
            blocksByBuilding.computeIfAbsent(buildingId, ignored -> new ArrayList<>())
                .add(toBlockData(block, constructionByBlock.get(block.getId()), engineeringByBlock.get(block.getId())));
        }

        return buildings.stream()
            .filter(building -> building.getId() != null)
            .map(building -> new ValidationUtils.BuildingData(
                building.getId(),
                building.getLabel(),
                building.getBuildingCode(),
                building.getHouseNumber(),
                building.getCategory(),
                building.getConstructionType(),
                building.getParkingType(),
                building.getInfraType(),
                Boolean.TRUE.equals(building.getHasNonResPart()),
                blocksByBuilding.getOrDefault(building.getId(), List.of())
            ))
            .toList();
    }

    private ValidationUtils.BlockData toBlockData(
        BuildingBlockEntity block,
        BlockConstructionEntity construction,
        BlockEngineeringEntity engineering
    ) {
        return new ValidationUtils.BlockData(
            block.getId(),
            block.getLabel(),
            block.getType(),
            block.getFloorsFrom(),
            block.getFloorsTo(),
            block.getFloorsCount(),
            block.getEntrancesCount(),
            block.getElevatorsCount(),
            block.getLevelsDepth(),
            block.getVehicleEntries(),
            block.getLightStructureType(),
            Boolean.TRUE.equals(block.getIsBasementBlock()),
            block.getLinkedBlockIdsAsList().stream().map(UUID::toString).toList(),
            block.getBasementDepth(),
            Boolean.TRUE.equals(block.getBasementHasParking()),
            block.getBasementParkingLevels() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(block.getBasementParkingLevels()),
            block.getBasementCommunications() == null ? new LinkedHashMap<>() : new LinkedHashMap<>(block.getBasementCommunications()),
            new ValidationUtils.ConstructionData(
                construction == null ? null : construction.getFoundation(),
                construction == null ? null : construction.getWalls(),
                construction == null ? null : construction.getSlabs(),
                construction == null ? null : construction.getRoof(),
                construction == null ? null : construction.getSeismicity()
            ),
            new ValidationUtils.EngineeringData(
                engineering != null && Boolean.TRUE.equals(engineering.getHasElectricity()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasWater()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasHotWater()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasSewerage()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasGas()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasHeatingLocal()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasHeatingCentral()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasVentilation()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasFirefighting()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasLowcurrent()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasInternet()),
                engineering != null && Boolean.TRUE.equals(engineering.getHasSolarPanels())
            )
        );
    }

    private List<ValidationUtils.FloorData> fetchFloors(List<UUID> blockIds) {
        if (blockIds.isEmpty()) {
            return List.of();
        }
        return floorJpaRepository.findByBlockIdIn(blockIds).stream()
            .map(this::toFloorData)
            .toList();
    }

    private ValidationUtils.FloorData toFloorData(FloorEntity floor) {
        return new ValidationUtils.FloorData(
            floor.getId(),
            floor.getBlockId(),
            floor.getLabel(),
            floor.getIndex(),
            floor.getFloorType(),
            floor.getIsStylobate(),
            floor.getIsDuplex(),
            floor.getHeight() == null ? null : floor.getHeight().doubleValue(),
            floor.getAreaProj() == null ? null : floor.getAreaProj().doubleValue(),
            floor.getAreaFact() == null ? null : floor.getAreaFact().doubleValue()
        );
    }

    private List<ValidationUtils.UnitData> fetchUnits(List<UUID> floorIds) {
        if (floorIds.isEmpty()) {
            return List.of();
        }
        return unitJpaRepository.findByFloorIdIn(floorIds).stream()
            .map(this::toUnitData)
            .toList();
    }

    private ValidationUtils.UnitData toUnitData(UnitEntity unit) {
        return new ValidationUtils.UnitData(unit.getId(), unit.getFloorId(), unit.getNumber(), unit.getUnitType());
    }

    private ValidationUtils.BuildingData findBuildingByBlock(List<ValidationUtils.BuildingData> buildings, UUID blockId) {
        for (ValidationUtils.BuildingData building : buildings) {
            boolean hasBlock = building.blocks().stream().anyMatch(block -> block.id().equals(blockId));
            if (hasBlock) {
                return building;
            }
        }
        return null;
    }

    private boolean isPositive(Integer value) {
        return value != null && value > 0;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String safe(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT);
    }

    private boolean isDuplexUnitType(String value) {
        String type = safe(value);
        return "duplex_up".equals(type) || "duplex_down".equals(type);
    }

    private int parseInt(String value, Integer fallback) {
        try {
            return Integer.parseInt(Objects.requireNonNullElse(value, ""));
        } catch (Exception ex) {
            return fallback == null ? 0 : fallback;
        }
    }
}
