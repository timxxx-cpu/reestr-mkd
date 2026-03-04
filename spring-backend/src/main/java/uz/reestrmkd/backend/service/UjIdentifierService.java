package uz.reestrmkd.backend.service;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class UjIdentifierService {

    public static final Map<String, String> BUILDING_TYPE_PREFIXES = Map.of(
        "residential", "ZR",
        "residential_multiblock", "ZM",
        "parking_separate", "ZP",
        "parking_integrated", "ZP",
        "infrastructure", "ZI"
    );

    public static final Map<String, String> UNIT_TYPE_PREFIXES = Map.ofEntries(
        Map.entry("flat", "EF"),
        Map.entry("duplex_up", "EF"),
        Map.entry("duplex_down", "EF"),
        Map.entry("office", "EO"),
        Map.entry("office_inventory", "EO"),
        Map.entry("non_res_block", "EO"),
        Map.entry("infrastructure", "EO"),
        Map.entry("parking_place", "EP")
    );

    public String generateProjectCode(Integer sequenceNumber) {
        int num = normalizeSequenceNumber(sequenceNumber);
        return "UJ" + String.format("%06d", num);
    }

    public String getBuildingPrefix(String category, boolean hasMultipleBlocks) {
        if ("residential".equals(category) || "residential_multiblock".equals(category)) {
            if ("residential_multiblock".equals(category)) {
                return "ZM";
            }
            return hasMultipleBlocks ? "ZM" : "ZR";
        }

        return BUILDING_TYPE_PREFIXES.getOrDefault(category, "ZR");
    }

    public String generateBuildingCode(String prefix, Integer sequenceNumber) {
        int num = normalizeSequenceNumber(sequenceNumber);
        String resolvedPrefix = (prefix == null || prefix.isBlank()) ? "ZR" : prefix;
        return resolvedPrefix + String.format("%02d", num);
    }

    public String getUnitPrefix(String unitType) {
        return UNIT_TYPE_PREFIXES.getOrDefault(unitType, "EF");
    }

    public String generateUnitCode(String prefix, Integer sequenceNumber) {
        int num = normalizeSequenceNumber(sequenceNumber);
        String resolvedPrefix = (prefix == null || prefix.isBlank()) ? "EF" : prefix;
        return resolvedPrefix + String.format("%04d", num);
    }

    public int getNextSequenceNumber(List<String> existingCodes, String prefix) {
        return FormatUtils.getNextSequenceNumber(existingCodes, prefix);
    }

    private int normalizeSequenceNumber(Integer value) {
        if (value == null || value < 0) {
            return 0;
        }
        return value;
    }
}
