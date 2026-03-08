package uz.reestrmkd.backend.domain.project.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class ProjectRegistryDetailsService {

    private final BuildingJpaRepository buildingJpaRepository;
    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final BlockFloorMarkerJpaRepository blockFloorMarkerJpaRepository;
    private final FloorJpaRepository floorJpaRepository;
    private final EntranceJpaRepository entranceJpaRepository;
    private final EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    private final UnitJpaRepository unitJpaRepository;
    private final CommonAreaJpaRepository commonAreaJpaRepository;

    public ProjectRegistryDetailsService(
        BuildingJpaRepository buildingJpaRepository,
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        BlockFloorMarkerJpaRepository blockFloorMarkerJpaRepository,
        FloorJpaRepository floorJpaRepository,
        EntranceJpaRepository entranceJpaRepository,
        EntranceMatrixJpaRepository entranceMatrixJpaRepository,
        UnitJpaRepository unitJpaRepository,
        CommonAreaJpaRepository commonAreaJpaRepository
    ) {
        this.buildingJpaRepository = buildingJpaRepository;
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.blockFloorMarkerJpaRepository = blockFloorMarkerJpaRepository;
        this.floorJpaRepository = floorJpaRepository;
        this.entranceJpaRepository = entranceJpaRepository;
        this.entranceMatrixJpaRepository = entranceMatrixJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
        this.commonAreaJpaRepository = commonAreaJpaRepository;
    }

    public Map<String, Object> getRegistryDetails(UUID projectId) {
        List<BuildingEntity> buildings = buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId);
        List<UUID> buildingIds = buildings.stream()
            .map(BuildingEntity::getId)
            .filter(Objects::nonNull)
            .toList();
        List<BuildingBlockEntity> blocks = buildingIds.isEmpty()
            ? List.of()
            : buildingBlockJpaRepository.findByBuildingIdIn(buildingIds);
        List<UUID> blockIds = blocks.stream()
            .map(BuildingBlockEntity::getId)
            .filter(Objects::nonNull)
            .toList();
        if (blockIds.isEmpty()) {
            return Map.of(
                "markerRows", List.of(),
                "floors", List.of(),
                "entrances", List.of(),
                "matrix", List.of(),
                "units", List.of(),
                "mops", List.of()
            );
        }

        List<BlockFloorMarkerEntity> markerRows = blockFloorMarkerJpaRepository.findByBlockIdIn(blockIds);
        List<FloorEntity> floors = floorJpaRepository.findByBlockIdIn(blockIds);
        List<UUID> floorIds = floors.stream()
            .map(FloorEntity::getId)
            .filter(Objects::nonNull)
            .toList();
        List<EntranceEntity> entrances = entranceJpaRepository.findByBlockIdIn(blockIds);
        List<EntranceMatrixEntity> matrix = entranceMatrixJpaRepository.findByBlockIdIn(blockIds);
        List<UnitEntity> units = floorIds.isEmpty() ? List.of() : unitJpaRepository.findByFloorIdIn(floorIds);
        List<CommonAreaEntity> mops = floorIds.isEmpty() ? List.of() : commonAreaJpaRepository.findByFloorIdIn(floorIds);

        return Map.of(
            "markerRows", markerRows.stream().map(this::toMarkerMap).toList(),
            "floors", floors.stream().map(this::toFloorMap).toList(),
            "entrances", entrances.stream().map(this::toEntranceMap).toList(),
            "matrix", matrix.stream().map(this::toMatrixMap).toList(),
            "units", units.stream().map(this::toUnitMap).toList(),
            "mops", mops.stream().map(this::toMopMap).toList()
        );
    }

    private Map<String, Object> toMarkerMap(BlockFloorMarkerEntity marker) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("block_id", marker.getBlockId());
        mapped.put("marker_key", marker.getMarkerKey());
        mapped.put("is_technical", marker.getIsTechnical());
        mapped.put("is_commercial", marker.getIsCommercial());
        return mapped;
    }

    private Map<String, Object> toFloorMap(FloorEntity floor) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", floor.getId());
        mapped.put("block_id", floor.getBlockId());
        mapped.put("floor_key", floor.getFloorKey());
        mapped.put("label", floor.getLabel());
        mapped.put("index", floor.getIndex());
        mapped.put("floor_type", floor.getFloorType());
        mapped.put("height", floor.getHeight());
        mapped.put("area_proj", floor.getAreaProj());
        mapped.put("area_fact", floor.getAreaFact());
        mapped.put("is_duplex", floor.getIsDuplex());
        mapped.put("parent_floor_index", floor.getParentFloorIndex());
        mapped.put("is_commercial", floor.getIsCommercial());
        mapped.put("is_technical", floor.getIsTechnical());
        mapped.put("is_stylobate", floor.getIsStylobate());
        mapped.put("is_basement", floor.getIsBasement());
        mapped.put("is_attic", floor.getIsAttic());
        mapped.put("is_loft", floor.getIsLoft());
        mapped.put("is_roof", floor.getIsRoof());
        mapped.put("basement_id", floor.getBasementId());
        return mapped;
    }

    private Map<String, Object> toEntranceMap(EntranceEntity entrance) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", entrance.getId());
        mapped.put("block_id", entrance.getBlockId());
        mapped.put("number", entrance.getNumber());
        return mapped;
    }

    private Map<String, Object> toMatrixMap(EntranceMatrixEntity row) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("floor_id", row.getFloorId());
        mapped.put("entrance_number", row.getEntranceNumber());
        mapped.put("flats_count", row.getFlatsCount());
        mapped.put("commercial_count", row.getCommercialCount());
        mapped.put("mop_count", row.getMopCount());
        return mapped;
    }

    private Map<String, Object> toUnitMap(UnitEntity unit) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", unit.getId());
        mapped.put("floor_id", unit.getFloorId());
        mapped.put("entrance_id", unit.getEntranceId());
        mapped.put("number", unit.getNumber());
        mapped.put("unit_type", unit.getUnitType());
        mapped.put("has_mezzanine", unit.getHasMezzanine());
        mapped.put("mezzanine_type", unit.getMezzanineType());
        mapped.put("total_area", unit.getTotalArea());
        mapped.put("living_area", unit.getLivingArea());
        mapped.put("useful_area", unit.getUsefulArea());
        mapped.put("rooms_count", unit.getRoomsCount());
        mapped.put("status", unit.getStatus());
        mapped.put("cadastre_number", unit.getCadastreNumber());
        return mapped;
    }

    private Map<String, Object> toMopMap(CommonAreaEntity mop) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", mop.getId());
        mapped.put("floor_id", mop.getFloorId());
        mapped.put("entrance_id", mop.getEntranceId());
        mapped.put("type", mop.getType());
        mapped.put("area", mop.getArea());
        mapped.put("height", mop.getHeight());
        return mapped;
    }
}
