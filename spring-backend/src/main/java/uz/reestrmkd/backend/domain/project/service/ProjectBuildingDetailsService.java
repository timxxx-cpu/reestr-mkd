package uz.reestrmkd.backend.domain.project.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.api.BuildingDetailsSaveRequestDto;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.BlockFloorMarkerSyncService;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixEnsureService;
import uz.reestrmkd.backend.domain.registry.service.EntranceReconcileService;
import uz.reestrmkd.backend.domain.registry.service.FloorsReconcileService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectBuildingDetailsService {

    private final BuildingJpaRepository buildingJpaRepository;
    private final FloorsReconcileService floorsReconcileService;
    private final EntranceReconcileService entranceReconcileService;
    private final EntranceMatrixEnsureService entranceMatrixEnsureService;
    private final BlockFloorMarkerSyncService blockFloorMarkerSyncService;
    private final ProjectBuildingDetailsPersistenceService projectBuildingDetailsPersistenceService;
    private final ObjectMapper objectMapper;

    public ProjectBuildingDetailsService(
        BuildingJpaRepository buildingJpaRepository,
        FloorsReconcileService floorsReconcileService,
        EntranceReconcileService entranceReconcileService,
        EntranceMatrixEnsureService entranceMatrixEnsureService,
        BlockFloorMarkerSyncService blockFloorMarkerSyncService,
        ProjectBuildingDetailsPersistenceService projectBuildingDetailsPersistenceService,
        ObjectMapper objectMapper
    ) {
        this.buildingJpaRepository = buildingJpaRepository;
        this.floorsReconcileService = floorsReconcileService;
        this.entranceReconcileService = entranceReconcileService;
        this.entranceMatrixEnsureService = entranceMatrixEnsureService;
        this.blockFloorMarkerSyncService = blockFloorMarkerSyncService;
        this.projectBuildingDetailsPersistenceService = projectBuildingDetailsPersistenceService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Map<String, Object> saveBuildingDetails(UUID projectId, BuildingDetailsSaveRequestDto payload) {
        Map<String, Object> buildingDetails = toBuildingDetails(payload);

        List<BuildingEntity> buildings = buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
        Set<UUID> knownBuildingIds = buildings.stream().map(BuildingEntity::getId).collect(Collectors.toSet());
        Map<UUID, BuildingEntity> buildingMetaById = buildings.stream().collect(Collectors.toMap(BuildingEntity::getId, building -> building));
        Map<UUID, List<UUID>> featureBasementIdsByBuilding = new HashMap<>();

        for (Map.Entry<String, Object> entry : buildingDetails.entrySet()) {
            String key = entry.getKey();
            if (!key.contains("_features")) {
                continue;
            }

            String buildingRaw = key.replace("_features", "");
            if (buildingRaw.length() != 36) {
                continue;
            }
            UUID buildingId = UUID.fromString(buildingRaw);
            if (!knownBuildingIds.contains(buildingId)) {
                continue;
            }

            BuildingEntity buildingMeta = buildingMetaById.get(buildingId);
            boolean isUndergroundParkingBuilding = buildingMeta != null
                && "parking_separate".equals(buildingMeta.getCategory())
                && "underground".equals(buildingMeta.getParkingType());
            boolean isAbovegroundLightOrOpenParking = buildingMeta != null
                && "parking_separate".equals(buildingMeta.getCategory())
                && "aboveground".equals(buildingMeta.getParkingType())
                && ("light".equals(buildingMeta.getConstructionType()) || "open".equals(buildingMeta.getConstructionType()));
            if (isUndergroundParkingBuilding || isAbovegroundLightOrOpenParking) {
                featureBasementIdsByBuilding.put(buildingId, List.of());
                continue;
            }

            List<Map<String, Object>> detailsBasements = asList(asMap(entry.getValue()).get("basements"));
            List<UUID> targetBlockIds = projectBuildingDetailsPersistenceService.findNonBasementBlockIds(buildingId);
            UUID singleTargetBlockId = targetBlockIds.size() == 1 ? targetBlockIds.get(0) : null;

            List<Map<String, Object>> sourceBasements = detailsBasements;
            if (buildingMeta != null && "infrastructure".equals(buildingMeta.getCategory()) && detailsBasements.size() > 1) {
                sourceBasements = detailsBasements.subList(0, 1);
            }

            List<UUID> ids = new ArrayList<>();
            int idx = 0;
            for (Map<String, Object> basement : sourceBasements) {
                if (basement.get("id") == null || basement.get("depth") == null) {
                    continue;
                }

                UUID basementId = UUID.fromString(String.valueOf(basement.get("id")));
                LinkedHashSet<UUID> linkedBlockIds = new LinkedHashSet<>();
                Object blocksValue = basement.get("blocks");
                if (blocksValue instanceof List<?> list) {
                    for (Object value : list) {
                        UUID id = parseUuid(value);
                        if (id != null) {
                            linkedBlockIds.add(id);
                        }
                    }
                }
                UUID blockIdFromPayload = parseUuid(basement.get("blockId"));
                if (blockIdFromPayload != null) {
                    linkedBlockIds.add(blockIdFromPayload);
                }
                if (linkedBlockIds.isEmpty() && singleTargetBlockId != null) {
                    linkedBlockIds.add(singleTargetBlockId);
                }

                int depth = normalizeBasementDepth(toNullableInt(basement.get("depth")));
                int basementEntrances = Math.min(10, Math.max(1, Optional.ofNullable(toNullableInt(basement.get("entrancesCount"))).orElse(1)));
                Map<String, Object> normalizedParkingLevels = normalizeParkingLevelsByDepth(asMap(basement.get("parkingLevels")), depth);
                Map<String, Object> normalizedCommunications = normalizeBasementCommunications(asMap(basement.get("communications")));
                Map<String, Object> normalizedBasementGeometry = toMultiPolygon(asMap(basement.get("blockGeometry")));

                projectBuildingDetailsPersistenceService.saveBasementBlock(
                    buildingId,
                    basementId,
                    "\u041F\u043E\u0434\u0432\u0430\u043B " + (idx + 1),
                    new ArrayList<>(linkedBlockIds),
                    depth,
                    toBool(basement.get("hasParking")),
                    normalizedParkingLevels,
                    normalizedCommunications,
                    basementEntrances,
                    normalizedBasementGeometry
                );

                floorsReconcileService.reconcile(basementId);
                entranceReconcileService.reconcile(basementId, basementEntrances);
                entranceMatrixEnsureService.ensureForBlock(basementId);

                ids.add(basementId);
                idx += 1;
            }

            featureBasementIdsByBuilding.put(buildingId, ids);
        }

        for (Map.Entry<UUID, List<UUID>> entry : featureBasementIdsByBuilding.entrySet()) {
            UUID buildingId = entry.getKey();
            if (!buildingDetails.containsKey(buildingId + "_features")) {
                continue;
            }
            projectBuildingDetailsPersistenceService.deleteMissingBasementBlocks(buildingId, entry.getValue());
        }

        for (Map.Entry<String, Object> entry : buildingDetails.entrySet()) {
            String key = entry.getKey();
            if (key.contains("_features")) {
                continue;
            }

            Map<String, Object> details = asMap(entry.getValue());
            String[] parts = key.split("_");
            String blockRaw = parts[parts.length - 1];
            if (blockRaw.length() != 36) {
                continue;
            }

            UUID blockId = UUID.fromString(blockRaw);
            UUID blockBuildingId = projectBuildingDetailsPersistenceService.findBuildingIdByBlockId(blockId);
            if (blockBuildingId == null) {
                continue;
            }

            Map<String, Object> normalizedBlockGeometry = toMultiPolygon(asMap(details.get("blockGeometry")));
            if (normalizedBlockGeometry != null) {
                validateBlockGeometry(normalizedBlockGeometry, buildingMetaById.get(blockBuildingId));
            }

            Integer entrances = firstNonNull(toNullableInt(details.get("entrances")), toNullableInt(details.get("inputs")));
            Integer floorsTo = toNullableInt(details.get("floorsTo"));
            Integer floorsCount = floorsTo != null ? floorsTo : toNullableInt(details.get("floorsCount"));

            projectBuildingDetailsPersistenceService.updateBlockDetails(
                blockId,
                floorsCount,
                entrances,
                toNullableInt(details.get("elevators")),
                toNullableInt(details.get("vehicleEntries")),
                toNullableInt(details.get("levelsDepth")),
                toNullIfBlank(details.get("lightStructureType")),
                parseUuidList(details.get("parentBlocks")),
                toNullableInt(details.get("floorsFrom")),
                floorsTo,
                toBool(details.get("hasBasementFloor")),
                toBool(details.get("hasAttic")),
                toBool(details.get("hasLoft")),
                toBool(details.get("hasExploitableRoof")),
                toBool(details.get("hasCustomAddress")),
                toNullIfBlank(details.get("customHouseNumber")),
                parseUuid(details.get("addressId")),
                normalizedBlockGeometry
            );

            blockFloorMarkerSyncService.sync(blockId, details);
            floorsReconcileService.reconcile(blockId);
            entranceReconcileService.reconcile(blockId, entrances == null ? 0 : entrances);
            entranceMatrixEnsureService.ensureForBlock(blockId);

            if (hasAny(details, "foundation", "walls", "slabs", "roof") || details.get("seismicity") != null) {
                projectBuildingDetailsPersistenceService.upsertBlockConstruction(
                    blockId,
                    toNullIfBlank(details.get("foundation")),
                    toNullIfBlank(details.get("walls")),
                    toNullIfBlank(details.get("slabs")),
                    toNullIfBlank(details.get("roof")),
                    toNullableInt(details.get("seismicity"))
                );
            }

            Map<String, Object> engineering = asMap(details.get("engineering"));
            if (!engineering.isEmpty()) {
                boolean heatingLocal = toBool(engineering.get("heatingLocal"));
                boolean heatingCentral = toBool(engineering.get("heatingCentral"));
                projectBuildingDetailsPersistenceService.upsertBlockEngineering(
                    blockId,
                    toBool(engineering.get("electricity")),
                    toBool(engineering.get("hvs")),
                    toBool(engineering.get("gvs")),
                    toBool(engineering.get("ventilation")),
                    toBool(engineering.get("firefighting")),
                    toBool(engineering.get("lowcurrent")),
                    toBool(engineering.get("sewerage")),
                    toBool(engineering.get("gas")),
                    heatingLocal,
                    heatingCentral,
                    toBool(engineering.get("internet")),
                    toBool(engineering.get("solarPanels"))
                );
            }
        }

        return Map.of("ok", true, "projectId", projectId);
    }

    private Map<String, Object> toBuildingDetails(BuildingDetailsSaveRequestDto payload) {
        Map<String, JsonNode> detailsNodeMap = payload == null || payload.buildingDetails() == null ? Map.of() : payload.buildingDetails();
        Map<String, Object> buildingDetails = new HashMap<>();
        for (Map.Entry<String, JsonNode> entry : detailsNodeMap.entrySet()) {
            buildingDetails.put(entry.getKey(), objectMapper.convertValue(entry.getValue(), new TypeReference<Map<String, Object>>() {}));
        }
        return buildingDetails;
    }

    private void validateBlockGeometry(Map<String, Object> normalizedBlockGeometry, BuildingEntity buildingMeta) {
        String buildingGeomText = buildingMeta == null || buildingMeta.getFootprintGeojson() == null
            ? null
            : jsonbString(buildingMeta.getFootprintGeojson());
        if (buildingGeomText == null) {
            return;
        }

        Double outsideRatio = buildingJpaRepository.calculateOutsideRatio(
            jsonbString(normalizedBlockGeometry),
            buildingGeomText
        );
        if (outsideRatio == null || outsideRatio > 0.01d) {
            throw new ApiException("Geometry exceeds building footprint by more than 1%", "VALIDATION_ERROR", null, 400);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        return list.stream().filter(Map.class::isInstance).map(item -> (Map<String, Object>) item).toList();
    }

    private Integer toNullableInt(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        String normalized = String.valueOf(value).trim();
        if (normalized.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(normalized);
        } catch (Exception ignored) {
            return null;
        }
    }

    private boolean toBool(Object value) {
        if (value instanceof Boolean booleanValue) {
            return booleanValue;
        }
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private <T> T firstNonNull(T left, T right) {
        return left != null ? left : right;
    }

    private boolean hasAny(Map<String, Object> details, String... fields) {
        for (String field : fields) {
            Object value = details.get(field);
            if (value == null) {
                continue;
            }
            if (value instanceof String stringValue && stringValue.isBlank()) {
                continue;
            }
            return true;
        }
        return false;
    }

    private UUID parseUuid(Object value) {
        if (value == null) {
            return null;
        }
        String raw = String.valueOf(value).trim();
        if (raw.isBlank() || raw.length() != 36) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<UUID> parseUuidList(Object value) {
        if (!(value instanceof List<?> list)) {
            return List.of();
        }
        List<UUID> ids = new ArrayList<>();
        for (Object item : list) {
            UUID id = parseUuid(item);
            if (id != null) {
                ids.add(id);
            }
        }
        return ids;
    }

    private String toNullIfBlank(Object value) {
        if (value == null) {
            return null;
        }
        String normalized = String.valueOf(value).trim();
        return normalized.isBlank() ? null : normalized;
    }

    private Map<String, Object> toMultiPolygon(Map<String, Object> geometry) {
        if (geometry.isEmpty()) {
            return null;
        }
        String type = String.valueOf(geometry.getOrDefault("type", ""));
        if ("MultiPolygon".equals(type)) {
            return geometry;
        }
        if ("Polygon".equals(type) && geometry.get("coordinates") != null) {
            return Map.of("type", "MultiPolygon", "coordinates", List.of(geometry.get("coordinates")));
        }
        return null;
    }

    private Map<String, Object> normalizeParkingLevelsByDepth(Map<String, Object> levels, int depth) {
        Map<String, Object> normalized = new HashMap<>();
        for (Map.Entry<String, Object> entry : levels.entrySet()) {
            Integer level = toNullableInt(entry.getKey());
            if (level == null || level < 1 || level > depth) {
                continue;
            }
            normalized.put(String.valueOf(level), toBool(entry.getValue()));
        }
        return normalized;
    }

    private Map<String, Object> normalizeBasementCommunications(Map<String, Object> communications) {
        Map<String, Object> normalized = new HashMap<>();
        for (String key : List.of("electricity", "water", "sewerage", "heating", "ventilation", "gas", "firefighting")) {
            normalized.put(key, toBool(communications.get(key)));
        }
        return normalized;
    }

    private int normalizeBasementDepth(Integer value) {
        int parsed = value == null ? 1 : value;
        return Math.min(4, Math.max(1, parsed));
    }

    private String jsonbString(Object value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (JsonProcessingException e) {
            throw new ApiException("Failed to encode json", "SERIALIZATION_ERROR", e.getMessage(), 500);
        }
    }
}
