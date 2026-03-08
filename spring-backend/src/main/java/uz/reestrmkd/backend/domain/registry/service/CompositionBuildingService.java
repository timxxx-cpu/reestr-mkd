package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.project.model.AddressEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectGeometryCandidateEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.AddressJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectGeometryCandidateJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.registry.model.BlockExtensionEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockExtensionJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class CompositionBuildingService {
    private static final String RESIDENTIAL_BLOCK_TYPE = "\u0416";
    private static final String NON_RESIDENTIAL_BLOCK_TYPE = "\u041d";
    private static final Map<String, Boolean> DEFAULT_BASEMENT_COMMUNICATIONS = Map.of(
        "electricity", false,
        "water", false,
        "sewerage", false,
        "heating", false,
        "ventilation", false,
        "gas", false,
        "firefighting", false
    );

    private final AddressJpaRepository addressJpaRepository;
    private final ProjectGeometryCandidateJpaRepository projectGeometryCandidateJpaRepository;
    private final ProjectJpaRepository projectJpaRepository;
    private final BuildingJpaRepository buildingJpaRepository;
    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final BlockExtensionJpaRepository blockExtensionJpaRepository;

    public CompositionBuildingService(
        AddressJpaRepository addressJpaRepository,
        ProjectGeometryCandidateJpaRepository projectGeometryCandidateJpaRepository,
        ProjectJpaRepository projectJpaRepository,
        BuildingJpaRepository buildingJpaRepository,
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        BlockExtensionJpaRepository blockExtensionJpaRepository
    ) {
        this.addressJpaRepository = addressJpaRepository;
        this.projectGeometryCandidateJpaRepository = projectGeometryCandidateJpaRepository;
        this.projectJpaRepository = projectJpaRepository;
        this.buildingJpaRepository = buildingJpaRepository;
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.blockExtensionJpaRepository = blockExtensionJpaRepository;
    }

    public List<Map<String, Object>> loadBuildings(UUID projectId) {
        List<BuildingEntity> buildings = buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
        if (buildings.isEmpty()) {
            return List.of();
        }

        List<UUID> buildingIds = buildings.stream().map(BuildingEntity::getId).filter(Objects::nonNull).toList();
        List<BuildingBlockEntity> blocks = buildingBlockJpaRepository.findByBuildingIdIn(buildingIds);

        Map<UUID, List<BuildingBlockEntity>> blocksByBuilding = blocks.stream()
            .filter(block -> block.getBuildingId() != null)
            .collect(Collectors.groupingBy(BuildingBlockEntity::getBuildingId, LinkedHashMap::new, Collectors.toList()));

        List<UUID> blockIds = blocks.stream().map(BuildingBlockEntity::getId).filter(Objects::nonNull).toList();
        Map<UUID, List<BlockExtensionEntity>> extensionsByBlock = blockIds.isEmpty()
            ? Map.of()
            : blockExtensionJpaRepository.findByParentBlockIdIn(blockIds).stream()
                .filter(extension -> extension.getParentBlockId() != null)
                .collect(Collectors.groupingBy(BlockExtensionEntity::getParentBlockId, LinkedHashMap::new, Collectors.toList()));

        List<Map<String, Object>> result = new ArrayList<>();
        for (BuildingEntity building : buildings) {
            List<BuildingBlockEntity> allBlocks = blocksByBuilding.getOrDefault(building.getId(), List.of());
            List<BuildingBlockEntity> activeBlocks = allBlocks.stream().filter(block -> !Boolean.TRUE.equals(block.getIsBasementBlock())).toList();
            List<BuildingBlockEntity> basementBlocks = allBlocks.stream().filter(block -> Boolean.TRUE.equals(block.getIsBasementBlock())).toList();

            int resBlocks = (int) activeBlocks.stream().filter(block -> RESIDENTIAL_BLOCK_TYPE.equals(block.getType())).count();
            int nonResBlocks = (int) activeBlocks.stream().filter(block -> NON_RESIDENTIAL_BLOCK_TYPE.equals(block.getType())).count();

            Map<String, Object> dto = new LinkedHashMap<>();
            dto.put("id", building.getId());
            dto.put("buildingCode", building.getBuildingCode());
            dto.put("label", building.getLabel());
            dto.put("houseNumber", building.getHouseNumber());
            dto.put("addressId", building.getAddressId());
            dto.put("effectiveAddressId", building.getAddressId());
            dto.put("category", building.getCategory());
            dto.put("type", building.getCategory());
            dto.put("stage", building.getStage() == null ? "Р СџРЎР‚Р С•Р ВµР С”РЎвЂљР Р…РЎвЂ№Р в„–" : building.getStage());
            dto.put("resBlocks", resBlocks);
            dto.put("nonResBlocks", nonResBlocks);
            dto.put("parkingType", normalizeParkingTypeFromDb(building.getParkingType()));
            dto.put("constructionType", normalizeParkingConstructionFromDb(building.getConstructionType()));
            dto.put("infraType", building.getInfraType());
            dto.put("hasNonResPart", building.getHasNonResPart() != null ? building.getHasNonResPart() : nonResBlocks > 0);
            dto.put("cadastreNumber", building.getCadastreNumber());
            dto.put("cadastre_number", building.getCadastreNumber());
            dto.put("geometry", building.getFootprintGeojson());
            dto.put("footprintGeojson", building.getFootprintGeojson());
            dto.put("buildingFootprintAreaM2", building.getBuildingFootprintAreaM2());
            dto.put("dateStart", building.getDateStart());
            dto.put("dateEnd", building.getDateEnd());
            dto.put("geometryCandidateId", building.getGeometryCandidateId());
            dto.put("basementsCount", basementBlocks.size());

            List<Map<String, Object>> mappedBlocks = allBlocks.stream()
                .map(block -> toBlockMap(block, extensionsByBlock.getOrDefault(block.getId(), List.of())))
                .sorted(Comparator.comparing(item -> String.valueOf(item.get("label"))))
                .toList();

            dto.put("blocks", mappedBlocks);
            result.add(dto);
        }

        return result;
    }

    @Transactional
    public Map<String, Object> createBuilding(UUID projectId, Map<String, Object> buildingData, List<Map<String, Object>> blocksData) {
        String geometryCandidateId = s(buildingData.get("geometryCandidateId"));
        if (geometryCandidateId == null || geometryCandidateId.isBlank()) {
            throw new ApiException("Geometry candidate is required for building save", "VALIDATION_ERROR", null, 400);
        }

        ProjectEntity project = projectJpaRepository.findById(projectId)
            .orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));

        String segment = generateNextBuildingCode(projectId, s(buildingData.get("category")), blocksData.size());
        String ujCode = project.getUjCode();
        String buildingCode = ujCode == null || ujCode.isBlank() ? segment : ujCode + "-" + segment;

        UUID addressId = buildingData.get("addressId") == null || s(buildingData.get("addressId")).isBlank()
            ? inheritBuildingAddressId(projectId, s(buildingData.get("houseNumber")))
            : UUID.fromString(s(buildingData.get("addressId")));

        Instant now = Instant.now();
        BuildingEntity building = new BuildingEntity();
        building.setId(UUID.randomUUID());
        building.setProjectId(projectId);
        building.setBuildingCode(buildingCode);
        building.setLabel(s(buildingData.get("label")));
        building.setHouseNumber(s(buildingData.get("houseNumber")));
        building.setAddressId(addressId);
        building.setCategory(s(buildingData.get("category")));
        building.setConstructionType(sanitizeConstructionType(buildingData));
        building.setParkingType(sanitizeParkingType(buildingData));
        building.setInfraType(sanitizeInfraType(buildingData));
        building.setHasNonResPart(b(buildingData.get("hasNonResPart")));
        building.setCreatedAt(now);
        building.setUpdatedAt(now);
        buildingJpaRepository.save(building);

        saveBlocks(building.getId(), blocksData, now, Set.of());
        syncBasements(building.getId(), buildingData, now);
        assignGeometry(projectId, building.getId(), UUID.fromString(geometryCandidateId));

        return Map.of("id", building.getId(), "ok", true);
    }

    @Transactional
    public Map<String, Object> updateBuilding(UUID buildingId, Map<String, Object> buildingData, List<Map<String, Object>> blocksData) {
        String geometryCandidateId = s(buildingData.get("geometryCandidateId"));
        if (geometryCandidateId == null || geometryCandidateId.isBlank()) {
            throw new ApiException("Geometry candidate is required for building save", "VALIDATION_ERROR", null, 400);
        }

        BuildingEntity building = buildingJpaRepository.findById(buildingId)
            .orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        UUID projectId = building.getProjectId();

        UUID addressId = buildingData.get("addressId") == null || s(buildingData.get("addressId")).isBlank()
            ? inheritBuildingAddressId(projectId, s(buildingData.get("houseNumber")))
            : UUID.fromString(s(buildingData.get("addressId")));

        building.setLabel(s(buildingData.get("label")));
        building.setHouseNumber(s(buildingData.get("houseNumber")));
        building.setAddressId(addressId);
        building.setConstructionType(sanitizeConstructionType(buildingData));
        building.setParkingType(sanitizeParkingType(buildingData));
        building.setInfraType(sanitizeInfraType(buildingData));
        building.setHasNonResPart(b(buildingData.get("hasNonResPart")));
        building.setUpdatedAt(Instant.now());
        buildingJpaRepository.save(building);

        if (blocksData != null) {
            List<BuildingBlockEntity> existingBlocks = buildingBlockJpaRepository.findByBuildingId(buildingId).stream()
                .filter(block -> !Boolean.TRUE.equals(block.getIsBasementBlock()))
                .toList();
            Set<UUID> existingIds = existingBlocks.stream().map(BuildingBlockEntity::getId).filter(Objects::nonNull).collect(Collectors.toSet());
            Set<UUID> nextIds = blocksData.stream()
                .map(block -> block.get("id") == null ? null : UUID.fromString(s(block.get("id"))))
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));

            saveBlocks(buildingId, blocksData, Instant.now(), existingIds);

            List<UUID> deleteIds = existingIds.stream().filter(id -> !nextIds.contains(id)).toList();
            if (!deleteIds.isEmpty()) {
                buildingBlockJpaRepository.deleteAllByIdInBatch(deleteIds);
            }
        }

        syncBasements(buildingId, buildingData, Instant.now());
        assignGeometry(projectId, buildingId, UUID.fromString(geometryCandidateId));
        return Map.of("id", buildingId, "ok", true);
    }

    @Transactional
    public Map<String, Object> deleteBuilding(UUID buildingId) {
        buildingJpaRepository.deleteById(buildingId);
        return Map.of("ok", true);
    }

    private void saveBlocks(UUID buildingId, List<Map<String, Object>> blocksData, Instant now, Set<UUID> existingIds) {
        if (blocksData == null || blocksData.isEmpty()) {
            return;
        }

        List<BuildingBlockEntity> entities = new ArrayList<>();
        for (Map<String, Object> block : blocksData) {
            UUID id = block.get("id") == null ? UUID.randomUUID() : UUID.fromString(s(block.get("id")));
            int floors = n(block.get("floorsCount"), 0);
            BuildingBlockEntity entity = existingIds.contains(id)
                ? buildingBlockJpaRepository.findById(id).orElseGet(BuildingBlockEntity::new)
                : new BuildingBlockEntity();
            entity.setId(id);
            entity.setBuildingId(buildingId);
            entity.setLabel(s(block.get("label")));
            entity.setType(mapBlockTypeToDb(s(block.get("type"))));
            entity.setFloorsCount(floors);
            entity.setFloorsFrom(1);
            entity.setFloorsTo(floors == 0 ? 1 : floors);
            if (entity.getCreatedAt() == null) {
                entity.setCreatedAt(now);
            }
            entity.setUpdatedAt(now);
            entities.add(entity);
        }
        buildingBlockJpaRepository.saveAll(entities);
    }

    private void syncBasements(UUID buildingId, Map<String, Object> buildingData, Instant now) {
        BuildingEntity building = buildingJpaRepository.findById(buildingId)
            .orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        Map<String, Object> basementContext = new LinkedHashMap<>();
        basementContext.put("category", building.getCategory());
        basementContext.put("parkingType", normalizeParkingTypeFromDb(building.getParkingType()));
        basementContext.put("constructionType", normalizeParkingConstructionFromDb(building.getConstructionType()));
        boolean allowed = canHaveBasements(basementContext);
        int target = allowed ? resolveBasementCount(buildingData) : 0;

        List<BuildingBlockEntity> allBlocks = buildingBlockJpaRepository.findByBuildingId(buildingId);
        List<BuildingBlockEntity> existingBasements = allBlocks.stream()
            .filter(block -> Boolean.TRUE.equals(block.getIsBasementBlock()))
            .sorted(Comparator.comparing(BuildingBlockEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
            .toList();
        List<UUID> nonBasementIds = allBlocks.stream()
            .filter(block -> !Boolean.TRUE.equals(block.getIsBasementBlock()))
            .map(BuildingBlockEntity::getId)
            .filter(Objects::nonNull)
            .toList();

        if (nonBasementIds.size() == 1) {
            UUID[] single = new UUID[]{nonBasementIds.getFirst()};
            List<BuildingBlockEntity> toUpdate = existingBasements.stream()
                .filter(block -> block.getLinkedBlockIds() == null || block.getLinkedBlockIds().length == 0)
                .toList();
            for (BuildingBlockEntity block : toUpdate) {
                block.setLinkedBlockIds(single);
                block.setUpdatedAt(now);
            }
            if (!toUpdate.isEmpty()) {
                buildingBlockJpaRepository.saveAll(toUpdate);
            }
        }

        if (existingBasements.size() < target) {
            UUID[] linked = nonBasementIds.size() == 1 ? new UUID[]{nonBasementIds.getFirst()} : new UUID[]{};
            List<BuildingBlockEntity> toCreate = new ArrayList<>();
            for (int i = 0; i < target - existingBasements.size(); i++) {
                BuildingBlockEntity block = new BuildingBlockEntity();
                block.setId(UUID.randomUUID());
                block.setBuildingId(buildingId);
                block.setLabel("Р СџР С•Р Т‘Р Р†Р В°Р В» " + (existingBasements.size() + i + 1));
                block.setType("BAS");
                block.setIsBasementBlock(true);
                block.setLinkedBlockIds(linked);
                block.setBasementDepth(1);
                block.setBasementHasParking(false);
                block.setBasementParkingLevels(new LinkedHashMap<>());
                block.setBasementCommunications(new LinkedHashMap<>(DEFAULT_BASEMENT_COMMUNICATIONS));
                block.setEntrancesCount(1);
                block.setCreatedAt(now);
                block.setUpdatedAt(now);
                toCreate.add(block);
            }
            buildingBlockJpaRepository.saveAll(toCreate);
        } else if (existingBasements.size() > target) {
            List<UUID> deleteIds = existingBasements.stream().skip(target).map(BuildingBlockEntity::getId).filter(Objects::nonNull).toList();
            if (!deleteIds.isEmpty()) {
                buildingBlockJpaRepository.deleteAllByIdInBatch(deleteIds);
            }
        }
    }

    private Map<String, Object> toBlockMap(BuildingBlockEntity block, List<BlockExtensionEntity> extensions) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", block.getId());
        mapped.put("label", block.getLabel());
        mapped.put("type", mapBlockTypeToUi(block.getType()));
        mapped.put("originalType", block.getType());
        mapped.put("floorsCount", block.getFloorsCount());
        mapped.put("isBasementBlock", Boolean.TRUE.equals(block.getIsBasementBlock()));
        mapped.put("linkedBlockIds", block.getLinkedBlockIdsAsList());
        mapped.put("extensions", extensions.stream().map(this::toExtensionMap).toList());
        return mapped;
    }

    private Map<String, Object> toExtensionMap(BlockExtensionEntity extension) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", extension.getId());
        item.put("label", extension.getLabel());
        item.put("extensionType", extension.getExtensionType());
        item.put("floorsCount", extension.getFloorsCount());
        item.put("startFloorIndex", extension.getStartFloorIndex());
        return item;
    }

    private UUID inheritBuildingAddressId(UUID projectId, String houseNumber) {
        if (houseNumber == null || houseNumber.isBlank()) return null;
        ProjectEntity project = projectJpaRepository.findById(projectId).orElse(null);
        if (project == null || project.getAddressId() == null) return null;

        AddressEntity parent = addressJpaRepository.findById(project.getAddressId()).orElse(null);
        if (parent == null) return null;

        AddressEntity address = new AddressEntity();
        address.setId(UUID.randomUUID());
        address.setDtype("Address");
        address.setVersionrev(0);
        address.setDistrict(parent.getDistrict());
        address.setStreet(parent.getStreet());
        address.setMahalla(parent.getMahalla());
        address.setCity(parent.getCity());
        address.setBuildingNo(houseNumber);
        address.setFullAddress(buildInheritedFullAddress(parent.getCity(), houseNumber));
        addressJpaRepository.save(address);
        return address.getId();
    }

    private String buildInheritedFullAddress(String city, String houseNumber) {
        String cityPart = city == null ? "" : city;
        String housePart = houseNumber == null ? "" : ", \u0434. " + houseNumber;
        return cityPart + housePart;
    }

    private String generateNextBuildingCode(UUID projectId, String category, int blocksCount) {
        String prefix = getBuildingPrefix(category, blocksCount > 1);
        List<String> rows = buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId).stream()
            .map(BuildingEntity::getBuildingCode)
            .filter(Objects::nonNull)
            .toList();

        int max = 0;
        for (String code : rows) {
            String segment = extractBuildingSegment(code);
            if (segment == null || !segment.startsWith(prefix)) continue;
            try {
                int n = Integer.parseInt(segment.substring(prefix.length()));
                max = Math.max(max, n);
            } catch (Exception ignored) {
            }
        }
        return prefix + String.format("%02d", max + 1);
    }

    private String extractBuildingSegment(String code) {
        if (code == null) return null;
        String[] parts = code.split("-");
        return parts.length > 1 ? parts[parts.length - 1] : code;
    }

    private String getBuildingPrefix(String category, boolean hasMultipleBlocks) {
        if ("residential_multiblock".equals(category)) return "ZM";
        if ("residential".equals(category)) return hasMultipleBlocks ? "ZM" : "ZR";
        if ("parking_separate".equals(category) || "parking_integrated".equals(category)) return "ZP";
        if ("infrastructure".equals(category)) return "ZI";
        return "ZR";
    }

    private String mapBlockTypeToUi(String dbType) {
        return switch (dbType) {
            case RESIDENTIAL_BLOCK_TYPE -> "residential";
            case NON_RESIDENTIAL_BLOCK_TYPE -> "non_residential";
            case "Parking" -> "parking";
            case "Infra" -> "infrastructure";
            case "BAS" -> "basement";
            default -> dbType;
        };
    }

    private String mapBlockTypeToDb(String uiType) {
        return switch (uiType) {
            case "residential" -> RESIDENTIAL_BLOCK_TYPE;
            case "non_residential" -> NON_RESIDENTIAL_BLOCK_TYPE;
            case "parking" -> "Parking";
            case "infrastructure" -> "Infra";
            case "basement" -> "BAS";
            default -> uiType;
        };
    }

    private String sanitizeConstructionType(Map<String, Object> buildingData) {
        if (!"parking_separate".equals(s(buildingData.get("category")))) return null;
        String type = s(buildingData.get("constructionType"));
        if ("capital".equals(type)) return "integrated";
        return type;
    }

    private String sanitizeParkingType(Map<String, Object> buildingData) {
        if (!"parking_separate".equals(s(buildingData.get("category")))) return null;
        String parkingType = s(buildingData.get("parkingType"));
        return "ground".equals(parkingType) ? "aboveground" : parkingType;
    }

    private String sanitizeInfraType(Map<String, Object> buildingData) {
        return "infrastructure".equals(s(buildingData.get("category"))) ? s(buildingData.get("infraType")) : null;
    }

    private boolean canHaveBasements(Map<String, Object> buildingData) {
        String category = s(buildingData.get("category"));
        if (!"parking_separate".equals(category)) return true;

        String parkingType = s(buildingData.get("parkingType"));
        String constructionType = s(buildingData.get("constructionType"));
        return !"aboveground".equals(parkingType) || (!"light".equals(constructionType) && !"open".equals(constructionType));
    }

    private int resolveBasementCount(Map<String, Object> buildingData) {
        int num = n(buildingData.get("basementsCount"), n(buildingData.get("basementCount"), 0));
        if (num <= 0) return 0;
        return Math.min(num, 10);
    }

    private String normalizeParkingTypeFromDb(String parkingType) {
        if ("aboveground".equals(parkingType)) return "ground";
        return parkingType;
    }

    private String normalizeParkingConstructionFromDb(String constructionType) {
        if ("separate".equals(constructionType) || "integrated".equals(constructionType)) return "capital";
        return constructionType;
    }

    private void assignGeometry(UUID projectId, UUID buildingId, UUID candidateId) {
        try {
            ProjectGeometryCandidateEntity candidate = projectGeometryCandidateJpaRepository.findByIdAndProjectId(candidateId, projectId)
                .orElseThrow(() -> new ApiException("Candidate not found", "NOT_FOUND", null, 404));
            String geojsonStr = candidate.getGeometry() == null ? null : candidate.getGeometry().toString();
            Object area = candidate.getAreaM2();
            if (geojsonStr == null || geojsonStr.isBlank()) {
                throw new ApiException("Candidate not found", "NOT_FOUND", null, 404);
            }

            Boolean hasLandPlot = projectJpaRepository.hasLandPlotGeom(projectId);
            if (!Boolean.TRUE.equals(hasLandPlot)) throw new ApiException("Land plot is not selected", "VALIDATION_ERROR", null, 400);

            Boolean covered = projectJpaRepository.isGeometryCoveredByLandPlot(projectId, geojsonStr);
            if (!Boolean.TRUE.equals(covered)) throw new ApiException("Building geometry must be within land plot", "VALIDATION_ERROR", null, 400);

            Boolean intersects = buildingJpaRepository.intersectsExistingBuildingGeometry(projectId, buildingId, geojsonStr);
            if (Boolean.TRUE.equals(intersects)) throw new ApiException("Building geometry intersects another building", "VALIDATION_ERROR", null, 400);

            Instant now = Instant.now();
            int updated = buildingJpaRepository.updateGeometryAssignment(
                buildingId,
                projectId,
                geojsonStr,
                candidate.getAreaM2(),
                candidateId,
                now
            );
            if (updated == 0) throw new ApiException("Building not found", "NOT_FOUND", null, 404);

            List<ProjectGeometryCandidateEntity> assignedCandidates =
                projectGeometryCandidateJpaRepository.findByProjectIdAndAssignedBuildingIdAndIdNot(projectId, buildingId, candidateId).stream()
                .peek(item -> {
                    item.setAssignedBuildingId(null);
                    item.setUpdatedAt(now);
                })
                .toList();
            if (!assignedCandidates.isEmpty()) {
                projectGeometryCandidateJpaRepository.saveAll(assignedCandidates);
            }
            candidate.setAssignedBuildingId(buildingId);
            candidate.setUpdatedAt(now);
            projectGeometryCandidateJpaRepository.save(candidate);
        } catch (org.springframework.dao.DataAccessException e) {
            throw new ApiException("Geometry validation failed", "GEOMETRY_VALIDATION_ERROR", e.getMessage(), 400);
        }
    }

    private int n(Object value, int fallback) {
        if (value == null) return fallback;
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return fallback;
        }
    }

    private Boolean b(Object value) {
        return value != null && (value instanceof Boolean v ? v : Boolean.parseBoolean(String.valueOf(value)));
    }

    private String s(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
