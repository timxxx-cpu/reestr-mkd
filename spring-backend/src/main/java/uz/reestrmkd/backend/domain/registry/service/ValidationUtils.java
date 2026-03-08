package uz.reestrmkd.backend.domain.registry.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class ValidationUtils {

    private ValidationUtils() {
    }

    public static ValidationError buildValidationError(String code, String title, String message, Map<String, Object> meta) {
        return new ValidationError(code, title, message, meta == null ? Map.of() : meta);
    }

    public static String getEntityTitle(BuildingData building, BlockData block) {
        String buildingCode = building != null && !isBlank(building.buildingCode()) ? "[" + building.buildingCode() + "] " : "";
        String houseNumber = building != null && !isBlank(building.houseNumber()) ? " (д. " + building.houseNumber() + ")" : "";
        String buildingLabel = building != null && !isBlank(building.label()) ? building.label() : "Неизвестный объект";

        if (block == null) {
            return buildingCode + "Объект: " + buildingLabel + houseNumber;
        }

        String blockLabel = !isBlank(block.label()) ? block.label() : "Основной блок";
        return buildingCode + "Объект: " + buildingLabel + houseNumber + " (Блок: " + blockLabel + ")";
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
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
        Boolean isDuplex,
        Double height,
        Double areaProj,
        Double areaFact
    ) {
    }

    public record UnitData(UUID id, UUID floorId, String number, String unitType) {
    }
}
