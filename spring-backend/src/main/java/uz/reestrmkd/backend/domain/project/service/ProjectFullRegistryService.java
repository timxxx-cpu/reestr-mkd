package uz.reestrmkd.backend.domain.project.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.RoomEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.RoomJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectFullRegistryService {

    private final BuildingJpaRepository buildingRepo;
    private final BuildingBlockJpaRepository blockRepo;
    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;
    private final UnitJpaRepository unitJpaRepository;
    private final RoomJpaRepository roomJpaRepository;

    public ProjectFullRegistryService(
        BuildingJpaRepository buildingRepo,
        BuildingBlockJpaRepository blockRepo,
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository,
        UnitJpaRepository unitJpaRepository,
        RoomJpaRepository roomJpaRepository
    ) {
        this.buildingRepo = buildingRepo;
        this.blockRepo = blockRepo;
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
        this.roomJpaRepository = roomJpaRepository;
    }

    public Map<String, Object> getFullRegistry(UUID projectId) {
        List<BuildingEntity> buildingEntities = buildingRepo.findByProjectIdOrderByCreatedAtAsc(projectId);
        List<UUID> buildingIds = buildingEntities.stream().map(BuildingEntity::getId).filter(Objects::nonNull).toList();
        List<BuildingBlockEntity> blockEntities = buildingIds.isEmpty() ? List.of() : blockRepo.findByBuildingIdIn(buildingIds);
        List<UUID> blockIds = blockEntities.stream().map(BuildingBlockEntity::getId).filter(Objects::nonNull).toList();
        List<FloorEntity> floorEntities = blockIds.isEmpty() ? List.of() : floorJpaRepository.findByBlockIdIn(blockIds);
        List<UUID> floorIds = floorEntities.stream().map(FloorEntity::getId).filter(Objects::nonNull).toList();
        List<EntranceEntity> entranceEntities = blockIds.isEmpty() ? List.of() : entranceJpaRepository.findByBlockIdIn(blockIds);
        List<UnitEntity> unitEntities = floorIds.isEmpty() ? List.of() : unitJpaRepository.findByFloorIdIn(floorIds);
        List<UUID> unitIds = unitEntities.stream().map(UnitEntity::getId).filter(Objects::nonNull).toList();
        List<RoomEntity> roomEntities = unitIds.isEmpty() ? List.of() : roomJpaRepository.findByUnit_IdIn(unitIds);

        Map<UUID, FloorEntity> floorsById = floorEntities.stream()
            .filter(floor -> floor.getId() != null)
            .collect(Collectors.toMap(FloorEntity::getId, floor -> floor, (left, right) -> left, LinkedHashMap::new));
        Map<UUID, BuildingBlockEntity> blocksById = blockEntities.stream()
            .filter(block -> block.getId() != null)
            .collect(Collectors.toMap(BuildingBlockEntity::getId, block -> block, (left, right) -> left, LinkedHashMap::new));
        Map<UUID, BuildingEntity> buildingsById = buildingEntities.stream()
            .filter(building -> building.getId() != null)
            .collect(Collectors.toMap(BuildingEntity::getId, building -> building, (left, right) -> left, LinkedHashMap::new));
        Map<UUID, List<Map<String, Object>>> roomsByUnit = roomEntities.stream()
            .filter(room -> room.getUnitId() != null)
            .collect(Collectors.groupingBy(
                RoomEntity::getUnitId,
                LinkedHashMap::new,
                Collectors.mapping(this::toRoomMap, Collectors.toList())
            ));

        Map<String, Object> response = new HashMap<>();
        response.put("buildings", buildingEntities.stream().map(this::toFullRegistryBuildingMap).toList());
        response.put("blocks", blockEntities.stream().map(this::toFullRegistryBlockMap).toList());
        response.put("floors", floorEntities.stream().map(this::toFullRegistryFloorMap).toList());
        response.put("entrances", entranceEntities.stream().map(this::toFullRegistryEntranceMap).toList());
        response.put("units", unitEntities.stream()
            .map(unit -> toFullRegistryUnitMap(unit, floorsById, blocksById, buildingsById, roomsByUnit))
            .toList());
        return response;
    }

    private Map<String, Object> toFullRegistryBuildingMap(BuildingEntity building) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", building.getId());
        mapped.put("projectId", building.getProjectId());
        mapped.put("buildingCode", building.getBuildingCode());
        mapped.put("label", building.getLabel());
        mapped.put("houseNumber", building.getHouseNumber());
        mapped.put("category", building.getCategory());
        return mapped;
    }

    private Map<String, Object> toFullRegistryBlockMap(BuildingBlockEntity block) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", block.getId());
        mapped.put("buildingId", block.getBuildingId());
        mapped.put("label", block.getLabel());
        mapped.put("tabLabel", block.getLabel());
        mapped.put("type", block.getType());
        mapped.put("isBasementBlock", block.getIsBasementBlock());
        mapped.put("floorsCount", block.getFloorsCount());
        return mapped;
    }

    private Map<String, Object> toFullRegistryFloorMap(FloorEntity floor) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", floor.getId());
        mapped.put("blockId", floor.getBlockId());
        mapped.put("index", floor.getIndex());
        mapped.put("label", floor.getLabel());
        mapped.put("type", floor.getFloorType());
        mapped.put("isDuplex", floor.getIsDuplex());
        return mapped;
    }

    private Map<String, Object> toFullRegistryEntranceMap(EntranceEntity entrance) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", entrance.getId());
        mapped.put("blockId", entrance.getBlockId());
        mapped.put("number", entrance.getNumber());
        return mapped;
    }

    private Map<String, Object> toRoomMap(RoomEntity room) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", room.getId());
        mapped.put("unitId", room.getUnitId());
        mapped.put("type", room.getRoomType());
        mapped.put("area", room.getArea());
        mapped.put("height", room.getRoomHeight());
        mapped.put("isMezzanine", room.getIsMezzanine());
        mapped.put("level", room.getLevel());
        return mapped;
    }

    private Map<String, Object> toFullRegistryUnitMap(
        UnitEntity unit,
        Map<UUID, FloorEntity> floorsById,
        Map<UUID, BuildingBlockEntity> blocksById,
        Map<UUID, BuildingEntity> buildingsById,
        Map<UUID, List<Map<String, Object>>> roomsByUnit
    ) {
        FloorEntity floor = floorsById.get(unit.getFloorId());
        BuildingBlockEntity block = floor == null ? null : blocksById.get(floor.getBlockId());
        BuildingEntity building = block == null ? null : buildingsById.get(block.getBuildingId());

        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", unit.getId());
        mapped.put("floorId", unit.getFloorId());
        mapped.put("entranceId", unit.getEntranceId());
        mapped.put("unitCode", unit.getUnitCode());
        mapped.put("type", unit.getUnitType());
        mapped.put("num", unit.getNumber());
        mapped.put("number", unit.getNumber());
        mapped.put("area", unit.getTotalArea());
        mapped.put("livingArea", unit.getLivingArea());
        mapped.put("usefulArea", unit.getUsefulArea());
        mapped.put("rooms", unit.getRoomsCount());
        mapped.put("hasMezzanine", unit.getHasMezzanine());
        mapped.put("mezzanineType", unit.getMezzanineType());
        mapped.put("cadastreNumber", unit.getCadastreNumber());
        mapped.put("buildingId", building == null ? null : building.getId());
        mapped.put("buildingCode", building == null ? null : building.getBuildingCode());
        mapped.put("explication", roomsByUnit.getOrDefault(unit.getId(), List.of()));
        return mapped;
    }
}
