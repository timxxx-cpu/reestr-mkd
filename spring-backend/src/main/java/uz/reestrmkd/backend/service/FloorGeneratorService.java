package uz.reestrmkd.backend.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.entity.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.entity.BuildingBlockEntity;
import uz.reestrmkd.backend.entity.BuildingEntity;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class FloorGeneratorService {

    public List<Map<String, Object>> generateFloorsModel(
        BuildingBlockEntity block,
        BuildingEntity building,
        List<BuildingBlockEntity> allBlocks,
        List<BlockFloorMarkerEntity> markers
    ) {
        List<Map<String, Object>> targetFloors = new ArrayList<>();

        boolean isParking = "parking_separate".equals(building.getCategory()) || "Parking".equals(block.getType());
        boolean isInfrastructure = "infrastructure".equals(building.getCategory()) || "Infra".equals(block.getType());
        boolean isUndergroundParking =
            isParking &&
                (
                    "underground".equals(building.getParkingType()) ||
                        "underground".equals(building.getConstructionType()) ||
                        NumberUtils.toInt(block.getLevelsDepth(), 0) > 0
                );

        java.util.function.Function<String, BlockFloorMarkerEntity> getMarker = (key) -> markers.stream()
            .filter(m -> key.equals(m.getMarkerKey()))
            .findFirst()
            .orElse(new BlockFloorMarkerEntity());

        if (isUndergroundParking) {
            int depth = NumberUtils.toInt(block.getLevelsDepth(), 1);
            for (int i = 1; i <= depth; i++) {
                String floorKey = "parking:-" + i;
                targetFloors.add(createFloorObj(block.getId(), Map.of(
                    "id", floorKeyToVirtualId(floorKey),
                    "index", -i,
                    "floor_key", floorKey,
                    "label", "Уровень -" + i,
                    "floor_type", "parking_floor",
                    "is_commercial", false
                )));
            }
            return targetFloors;
        }

        List<BuildingBlockEntity> blockBasements = (allBlocks == null ? List.<BuildingBlockEntity>of() : allBlocks).stream()
            .filter(b -> Boolean.TRUE.equals(b.getIsBasementBlock()) && b.getLinkedBlockIds() != null && Arrays.asList(b.getLinkedBlockIds()).contains(block.getId()))
            .toList();
        boolean hasMultipleBasements = blockBasements.size() > 1;

        for (int bIdx = 0; bIdx < blockBasements.size(); bIdx++) {
            BuildingBlockEntity b = blockBasements.get(bIdx);
            int depth = NumberUtils.toInt(b.getBasementDepth(), 1);
            for (int d = depth; d >= 1; d--) {
                Map<String, Object> levelsMap = b.getBasementParkingLevels() != null ? b.getBasementParkingLevels() : Map.of();
                boolean isMixed =
                    Boolean.TRUE.equals(getMarker.apply("basement_" + b.getId()).getIsCommercial()) ||
                        Boolean.TRUE.equals(getMarker.apply("basement").getIsCommercial()) ||
                        Boolean.TRUE.equals(levelsMap.get(String.valueOf(d)));
                String label = "Подвал (этаж -" + d + ")";
                if (hasMultipleBasements) {
                    label = "Подвал " + (bIdx + 1) + " (этаж -" + d + ")";
                }

                targetFloors.add(createFloorObj(block.getId(), mapOfEntries(
                    Map.entry("id", "base_" + b.getId() + "_L" + d),
                    Map.entry("index", -d),
                    Map.entry("floor_key", "basement:" + b.getId() + ":" + d),
                    Map.entry("label", label),
                    Map.entry("floor_type", "basement"),
                    Map.entry("basement_id", b.getId()),
                    Map.entry("is_commercial", isMixed),
                    Map.entry("is_basement", true)
                )));
            }
        }

        if (Boolean.TRUE.equals(block.getHasBasement())) {
            boolean isTsokolMixed = Boolean.TRUE.equals(getMarker.apply("tsokol").getIsCommercial());
            targetFloors.add(createFloorObj(block.getId(), Map.of(
                "id", "tsokol",
                "index", 0,
                "floor_key", "tsokol",
                "label", "Цокольный этаж",
                "floor_type", "tsokol",
                "is_commercial", isTsokolMixed
            )));
        }

        Map<Integer, String> stylobateMap = new HashMap<>();
        if ("Ж".equals(block.getType())) {
            for (BuildingBlockEntity b : allBlocks) {
                if (Boolean.TRUE.equals(b.getIsBasementBlock())) {
                    continue;
                }
                if ("Н".equals(b.getType()) && b.getParentBlocks() != null && Arrays.asList(b.getParentBlocks()).contains(block.getId())) {
                    int h = NumberUtils.toInt(b.getFloorsTo(), 0);
                    for (int k = 1; k <= h; k++) {
                        stylobateMap.put(k, b.getLabel());
                    }
                }
            }
        }

        int start;
        int end;

        if (isParking || isInfrastructure) {
            start = 1;
            end = NumberUtils.toInt(block.getFloorsCount(), 1);
        } else {
            start = NumberUtils.toInt(block.getFloorsFrom(), 1);
            end = NumberUtils.toInt(block.getFloorsTo(), 1);
        }

        for (int i = start; i <= end; i++) {
            String stylobateLabel = stylobateMap.get(i);
            String floorKey = "floor:" + i;
            BlockFloorMarkerEntity marker = getMarker.apply(String.valueOf(i));
            boolean isMixed = Boolean.TRUE.equals(marker.getIsCommercial());

            if (stylobateLabel != null) {
                targetFloors.add(createFloorObj(block.getId(), mapOfEntries(
                    Map.entry("id", "floor_" + i),
                    Map.entry("index", i),
                    Map.entry("floor_key", floorKey),
                    Map.entry("label", i + " этаж"),
                    Map.entry("floor_type", "stylobate"),
                    Map.entry("is_commercial", true),
                    Map.entry("is_stylobate", true)
                )));
            } else {
                String type = "residential";
                if ("Н".equals(block.getType())) {
                    type = "office";
                }
                if (isParking) {
                    type = "parking_floor";
                }
                if (isInfrastructure) {
                    type = "office";
                }
                if ("Ж".equals(block.getType()) && isMixed) {
                    type = "mixed";
                }

                targetFloors.add(createFloorObj(block.getId(), mapOfEntries(
                    Map.entry("id", "floor_" + i),
                    Map.entry("index", i),
                    Map.entry("floor_key", floorKey),
                    Map.entry("label", i + " этаж"),
                    Map.entry("floor_type", type),
                    Map.entry("is_commercial", isMixed || "office".equals(type))
                )));
            }

            BlockFloorMarkerEntity techMarker = getMarker.apply(i + "-Т");
            if (Boolean.TRUE.equals(techMarker.getIsTechnical())) {
                targetFloors.add(createFloorObj(block.getId(), mapOfEntries(
                    Map.entry("id", "floor_" + i + "_tech"),
                    Map.entry("index", i),
                    Map.entry("floor_key", "tech:" + i),
                    Map.entry("label", i + "-Т (Технический)"),
                    Map.entry("floor_type", "technical"),
                    Map.entry("is_commercial", Boolean.TRUE.equals(techMarker.getIsCommercial())),
                    Map.entry("is_technical", true),
                    Map.entry("parent_floor_index", i)
                )));
            }
        }

        markers.stream()
            .filter(m -> "technical".equals(m.getMarkerType()) && NumberUtils.toInt(m.getFloorIndex(), 0) > end)
            .forEach(m -> {
                int fIdx = NumberUtils.toInt(m.getFloorIndex(), 0);
                targetFloors.add(createFloorObj(block.getId(), mapOfEntries(
                    Map.entry("id", "floor_" + fIdx + "_tech_extra"),
                    Map.entry("index", fIdx),
                    Map.entry("floor_key", "tech:" + fIdx),
                    Map.entry("label", fIdx + " (Тех)"),
                    Map.entry("floor_type", "technical"),
                    Map.entry("is_technical", true),
                    Map.entry("parent_floor_index", fIdx)
                )));
            });

        if (Boolean.TRUE.equals(block.getHasAttic())) {
            targetFloors.add(createFloorObj(block.getId(), mapOfEntries(
                Map.entry("id", "attic"),
                Map.entry("index", end + 1),
                Map.entry("floor_key", "attic"),
                Map.entry("label", "Мансарда"),
                Map.entry("floor_type", "attic"),
                Map.entry("is_commercial", Boolean.TRUE.equals(getMarker.apply("attic").getIsCommercial())),
                Map.entry("is_attic", true)
            )));
        }

        if (Boolean.TRUE.equals(block.getHasLoft())) {
            targetFloors.add(createFloorObj(block.getId(), mapOfEntries(
                Map.entry("id", "loft"),
                Map.entry("index", end + 2),
                Map.entry("floor_key", "loft"),
                Map.entry("label", "Чердак"),
                Map.entry("floor_type", "loft"),
                Map.entry("is_commercial", Boolean.TRUE.equals(getMarker.apply("loft").getIsCommercial())),
                Map.entry("is_loft", true)
            )));
        }

        if (Boolean.TRUE.equals(block.getHasRoofExpl())) {
            targetFloors.add(createFloorObj(block.getId(), mapOfEntries(
                Map.entry("id", "roof"),
                Map.entry("index", end + 3),
                Map.entry("floor_key", "roof"),
                Map.entry("label", "Эксплуатируемая кровля"),
                Map.entry("floor_type", "roof"),
                Map.entry("is_commercial", Boolean.TRUE.equals(getMarker.apply("roof").getIsCommercial())),
                Map.entry("is_roof", true)
            )));
        }

        return targetFloors;
    }

    private Map<String, Object> createFloorObj(UUID blockId, Map<String, Object> overrides) {
        Map<String, Object> result = new HashMap<>();
        result.put("block_id", blockId);
        result.put("height", null);
        result.put("area_proj", 0);
        result.put("is_technical", false);
        result.put("is_commercial", false);
        result.put("is_stylobate", false);
        result.put("is_basement", false);
        result.put("is_attic", false);
        result.put("is_loft", false);
        result.put("is_roof", false);
        result.put("parent_floor_index", null);
        result.put("basement_id", null);
        result.putAll(overrides);
        return result;
    }

    @SafeVarargs
    private static Map<String, Object> mapOfEntries(Map.Entry<String, Object>... entries) {
        Map<String, Object> result = new HashMap<>();
        for (Map.Entry<String, Object> entry : entries) {
            result.put(entry.getKey(), entry.getValue());
        }
        return result;
    }

    private static final class NumberUtils {
        private static int toInt(Integer value, int fallback) {
            return value == null ? fallback : value;
        }
    }

    private static String floorKeyToVirtualId(String floorKey) {
        if (floorKey == null || floorKey.isBlank()) {
            return null;
        }
        if (floorKey.startsWith("floor:")) {
            return "floor_" + floorKey.substring("floor:".length());
        }
        if (floorKey.startsWith("parking:")) {
            String part = floorKey.substring("parking:".length());
            String level = part.startsWith("-") ? part.substring(1) : part;
            return "level_minus_" + level;
        }
        if (floorKey.startsWith("basement:")) {
            String[] parts = floorKey.split(":");
            if (parts.length >= 3) {
                String depth = parts[parts.length - 1];
                StringBuilder baseId = new StringBuilder();
                for (int i = 1; i < parts.length - 1; i++) {
                    if (baseId.length() > 0) {
                        baseId.append(":");
                    }
                    baseId.append(parts[i]);
                }
                return "base_" + baseId + "_L" + depth;
            }
        }
        if (floorKey.startsWith("tech:")) {
            return "floor_" + floorKey.substring("tech:".length()) + "_tech";
        }
        return floorKey;
    }
}
