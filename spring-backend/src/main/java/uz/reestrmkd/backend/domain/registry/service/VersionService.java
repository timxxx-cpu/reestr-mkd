package uz.reestrmkd.backend.domain.registry.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.registry.model.BlockConstructionEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockEngineeringEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.ObjectVersionEntity;
import uz.reestrmkd.backend.domain.registry.model.RoomEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockConstructionJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BlockEngineeringJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.ObjectVersionJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.RoomJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class VersionService {

    private static final String VERSION_STATUS_PENDING = "PENDING";
    private static final String VERSION_STATUS_CURRENT = "CURRENT";
    private static final String VERSION_STATUS_DECLINED = "DECLINED";

    private final boolean versioningEnabled;
    private final ObjectMapper objectMapper;
    private final ProjectJpaRepository projectJpaRepository;
    private final BuildingJpaRepository buildingJpaRepository;
    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;
    private final BlockConstructionJpaRepository blockConstructionJpaRepository;
    private final BlockEngineeringJpaRepository blockEngineeringJpaRepository;
    private final BlockFloorMarkerJpaRepository blockFloorMarkerJpaRepository;
    private final EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    private final UnitJpaRepository unitJpaRepository;
    private final CommonAreaJpaRepository commonAreaJpaRepository;
    private final RoomJpaRepository roomJpaRepository;
    private final ObjectVersionJpaRepository objectVersionJpaRepository;

    public VersionService(
        @Value("${VERSIONING_ENABLED:false}") boolean versioningEnabled,
        ObjectMapper objectMapper,
        ProjectJpaRepository projectJpaRepository,
        BuildingJpaRepository buildingJpaRepository,
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository,
        BlockConstructionJpaRepository blockConstructionJpaRepository,
        BlockEngineeringJpaRepository blockEngineeringJpaRepository,
        BlockFloorMarkerJpaRepository blockFloorMarkerJpaRepository,
        EntranceMatrixJpaRepository entranceMatrixJpaRepository,
        UnitJpaRepository unitJpaRepository,
        CommonAreaJpaRepository commonAreaJpaRepository,
        RoomJpaRepository roomJpaRepository,
        ObjectVersionJpaRepository objectVersionJpaRepository
    ) {
        this.versioningEnabled = versioningEnabled;
        this.objectMapper = objectMapper;
        this.projectJpaRepository = projectJpaRepository;
        this.buildingJpaRepository = buildingJpaRepository;
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
        this.blockConstructionJpaRepository = blockConstructionJpaRepository;
        this.blockEngineeringJpaRepository = blockEngineeringJpaRepository;
        this.blockFloorMarkerJpaRepository = blockFloorMarkerJpaRepository;
        this.entranceMatrixJpaRepository = entranceMatrixJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
        this.commonAreaJpaRepository = commonAreaJpaRepository;
        this.roomJpaRepository = roomJpaRepository;
        this.objectVersionJpaRepository = objectVersionJpaRepository;
    }

    @Transactional
    public CreatePendingVersionsResult createPendingVersionsForApplication(@org.springframework.lang.NonNull UUID projectId, UUID applicationId, String createdBy) {
        if (!versioningEnabled) {
            return new CreatePendingVersionsResult(true, 0, true);
        }

        List<VersionEntitySnapshot> entities = collectProjectVersionEntities(projectId);
        int createdCount = 0;

        for (VersionEntitySnapshot entity : entities) {
            List<ObjectVersionEntity> existing = objectVersionJpaRepository
                .findByEntityTypeAndEntityIdOrderByVersionNumberDesc(entity.entityType(), entity.entityId());

            boolean hasPending = existing.stream().anyMatch(v -> VERSION_STATUS_PENDING.equals(v.getVersionStatus()));
            if (hasPending) {
                continue;
            }

            ObjectVersionEntity latestCurrent = existing.stream()
                .filter(v -> VERSION_STATUS_CURRENT.equals(v.getVersionStatus()))
                .findFirst()
                .orElse(null);

            ObjectVersionEntity objectVersionEntity = new ObjectVersionEntity();
            objectVersionEntity.setEntityType(entity.entityType());
            objectVersionEntity.setEntityId(entity.entityId());
            objectVersionEntity.setVersionNumber((existing.isEmpty() ? 0 : existing.get(0).getVersionNumber()) + 1);
            objectVersionEntity.setVersionStatus(VERSION_STATUS_PENDING);
            objectVersionEntity.setSnapshotData(latestCurrent != null
                ? latestCurrent.getSnapshotData()
                : objectMapper.convertValue(entity.snapshotData(), new TypeReference<Map<String, Object>>() {
                }));
            objectVersionEntity.setCreatedBy(createdBy);
            objectVersionEntity.setApplicationId(applicationId);
            objectVersionEntity.setUpdatedAt(Instant.now());
            objectVersionJpaRepository.save(objectVersionEntity);
            createdCount += 1;
        }

        return new CreatePendingVersionsResult(true, createdCount, false);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getVersions(String entityType, UUID entityId) {
        List<ObjectVersionEntity> versions = entityType != null && entityId != null
            ? objectVersionJpaRepository.findByEntityTypeAndEntityIdOrderByVersionNumberDesc(entityType, entityId)
            : objectVersionJpaRepository.findTop100ByOrderByUpdatedAtDesc();
        return versions.stream()
            .map(this::toVersionMap)
            .toList();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSnapshot(Long versionId) {
        ObjectVersionEntity version = requireVersion(versionId);
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("snapshot_data", version.getSnapshotData());
        return mapped;
    }

    @Transactional
    public void approveVersion(Long versionId) {
        updateVersionStatus(versionId, VERSION_STATUS_CURRENT);
    }

    @Transactional
    public void declineVersion(Long versionId) {
        updateVersionStatus(versionId, VERSION_STATUS_DECLINED);
    }

    @Transactional
    public void restoreVersion(Long versionId) {
        updateVersionStatus(versionId, VERSION_STATUS_CURRENT);
    }

    public List<VersionEntitySnapshot> collectProjectVersionEntities(@org.springframework.lang.NonNull UUID projectId) {
        List<VersionEntitySnapshot> entities = new ArrayList<>();

        ProjectEntity projectRow = projectJpaRepository.findById(projectId).orElse(null);
        if (projectRow != null) {
            entities.add(new VersionEntitySnapshot("project", projectRow.getId(), projectRow));
        }

        List<BuildingEntity> buildings = buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
        for (BuildingEntity row : buildings) {
            entities.add(new VersionEntitySnapshot("building", row.getId(), row));
        }

        List<UUID> buildingIds = buildings.stream().map(BuildingEntity::getId).toList();
        if (buildingIds.isEmpty()) {
            return entities;
        }

        List<BuildingBlockEntity> blocks = buildingBlockJpaRepository.findByBuildingIdIn(buildingIds);
        for (BuildingBlockEntity row : blocks) {
            entities.add(new VersionEntitySnapshot("building_block", row.getId(), row));
        }

        List<UUID> blockIds = blocks.stream().map(BuildingBlockEntity::getId).toList();
        if (blockIds.isEmpty()) {
            return entities;
        }

        List<BuildingBlockEntity> basementBlocks = blocks.stream().filter(b -> Boolean.TRUE.equals(b.getIsBasementBlock())).toList();
        List<FloorEntity> floors = floorJpaRepository.findByBlockIdIn(blockIds);
        List<EntranceEntity> entrances = entranceJpaRepository.findByBlockIdIn(blockIds);
        List<BlockConstructionEntity> blockConstruction = blockConstructionJpaRepository.findByBlockIdIn(blockIds);
        List<BlockEngineeringEntity> blockEngineering = blockEngineeringJpaRepository.findByBlockIdIn(blockIds);
        List<BlockFloorMarkerEntity> blockMarkers = blockFloorMarkerJpaRepository.findByBlockIdIn(blockIds);
        List<EntranceMatrixEntity> entranceMatrix = entranceMatrixJpaRepository.findByBlockIdIn(blockIds);

        for (BuildingBlockEntity row : basementBlocks) entities.add(new VersionEntitySnapshot("basement_block", row.getId(), row));
        for (FloorEntity row : floors) entities.add(new VersionEntitySnapshot("floor", row.getId(), row));
        for (EntranceEntity row : entrances) entities.add(new VersionEntitySnapshot("entrance", row.getId(), row));
        for (BlockConstructionEntity row : blockConstruction)
            entities.add(new VersionEntitySnapshot("block_construction", row.getId(), row));
        for (BlockEngineeringEntity row : blockEngineering)
            entities.add(new VersionEntitySnapshot("block_engineering", row.getId(), row));
        for (BlockFloorMarkerEntity row : blockMarkers)
            entities.add(new VersionEntitySnapshot("block_floor_marker", row.getId(), row));
        for (EntranceMatrixEntity row : entranceMatrix)
            entities.add(new VersionEntitySnapshot("entrance_matrix", row.getId(), row));

        List<UUID> floorIds = floors.stream().map(FloorEntity::getId).toList();

        List<UnitEntity> units = floorIds.isEmpty() ? List.of() : unitJpaRepository.findByFloorIdIn(floorIds);
        List<CommonAreaEntity> commonAreas = floorIds.isEmpty() ? List.of() : commonAreaJpaRepository.findByFloorIdIn(floorIds);

        for (UnitEntity row : units) entities.add(new VersionEntitySnapshot("unit", row.getId(), row));
        for (CommonAreaEntity row : commonAreas)
            entities.add(new VersionEntitySnapshot("common_area", row.getId(), row));

        List<UUID> unitIds = units.stream().map(UnitEntity::getId).toList();
        if (!unitIds.isEmpty()) {
            List<RoomEntity> rooms = roomJpaRepository.findByUnit_IdIn(unitIds);
            for (RoomEntity row : rooms) {
                entities.add(new VersionEntitySnapshot("room", row.getId(), row));
            }
        }

        return entities;
    }

    private void updateVersionStatus(Long versionId, String status) {
        ObjectVersionEntity version = requireVersion(versionId);
        version.setVersionStatus(status);
        version.setUpdatedAt(Instant.now());
        objectVersionJpaRepository.save(version);
    }

    private ObjectVersionEntity requireVersion(Long versionId) {
        return objectVersionJpaRepository.findById(versionId)
            .orElseThrow(() -> new ApiException("Version not found", "NOT_FOUND", null, 404));
    }

    private Map<String, Object> toVersionMap(ObjectVersionEntity version) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", version.getId());
        mapped.put("entity_type", version.getEntityType());
        mapped.put("entity_id", version.getEntityId());
        mapped.put("version_number", version.getVersionNumber());
        mapped.put("version_status", version.getVersionStatus());
        mapped.put("snapshot_data", version.getSnapshotData());
        mapped.put("created_by", version.getCreatedBy());
        mapped.put("application_id", version.getApplicationId());
        mapped.put("updated_at", version.getUpdatedAt());
        return mapped;
    }

    public record VersionEntitySnapshot(String entityType, UUID entityId, Object snapshotData) {
    }

    public record CreatePendingVersionsResult(boolean ok, int createdCount, boolean skipped) {
    }
}
