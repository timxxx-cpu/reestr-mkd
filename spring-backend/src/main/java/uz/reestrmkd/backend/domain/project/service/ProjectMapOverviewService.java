package uz.reestrmkd.backend.domain.project.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectMapOverviewService {

    private final ProjectJpaRepository projectJpaRepository;
    private final ApplicationJpaRepository applicationJpaRepository;
    private final BuildingJpaRepository buildingJpaRepository;
    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final FloorJpaRepository floorJpaRepository;
    private final UnitJpaRepository unitJpaRepository;

    public ProjectMapOverviewService(
        ProjectJpaRepository projectJpaRepository,
        ApplicationJpaRepository applicationJpaRepository,
        BuildingJpaRepository buildingJpaRepository,
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        FloorJpaRepository floorJpaRepository,
        UnitJpaRepository unitJpaRepository
    ) {
        this.projectJpaRepository = projectJpaRepository;
        this.applicationJpaRepository = applicationJpaRepository;
        this.buildingJpaRepository = buildingJpaRepository;
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.floorJpaRepository = floorJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> mapOverview(String scope) {
        if (scope == null || scope.isBlank()) {
            throw new ApiException("Scope is required", "MISSING_SCOPE", null, 400);
        }

        List<ProjectEntity> projects = projectJpaRepository.findByScopeIdOrderByUpdatedAtDesc(scope);
        List<ApplicationEntity> applications = applicationJpaRepository.findByScopeIdOrderByUpdatedAtDesc(scope);
        List<UUID> projectIds = projects.stream().map(ProjectEntity::getId).filter(Objects::nonNull).toList();

        Map<UUID, List<Map<String, Object>>> buildingsByProject = new LinkedHashMap<>();
        if (!projectIds.isEmpty()) {
            List<BuildingEntity> buildings = buildingJpaRepository.findByProjectIdIn(projectIds);
            List<UUID> buildingIds = buildings.stream().map(BuildingEntity::getId).filter(Objects::nonNull).toList();

            Map<UUID, List<BuildingBlockEntity>> blocksByBuilding = new LinkedHashMap<>();
            Map<UUID, List<FloorEntity>> floorsByBlock = new LinkedHashMap<>();
            Map<UUID, List<UnitEntity>> unitsByFloor = new LinkedHashMap<>();

            if (!buildingIds.isEmpty()) {
                List<BuildingBlockEntity> blocks = buildingBlockJpaRepository.findByBuildingIdIn(buildingIds);
                blocksByBuilding = blocks.stream().collect(Collectors.groupingBy(BuildingBlockEntity::getBuildingId, LinkedHashMap::new, Collectors.toList()));

                List<UUID> blockIds = blocks.stream().map(BuildingBlockEntity::getId).filter(Objects::nonNull).toList();
                if (!blockIds.isEmpty()) {
                    List<FloorEntity> floors = floorJpaRepository.findByBlockIdIn(blockIds);
                    floorsByBlock = floors.stream().collect(Collectors.groupingBy(FloorEntity::getBlockId, LinkedHashMap::new, Collectors.toList()));

                    List<UUID> floorIds = floors.stream().map(FloorEntity::getId).filter(Objects::nonNull).toList();
                    if (!floorIds.isEmpty()) {
                        List<UnitEntity> units = unitJpaRepository.findByFloorIdIn(floorIds);
                        unitsByFloor = units.stream().collect(Collectors.groupingBy(UnitEntity::getFloorId, LinkedHashMap::new, Collectors.toList()));
                    }
                }
            }

            final Map<UUID, List<FloorEntity>> floorsByBlockFinal = floorsByBlock;
            final Map<UUID, List<UnitEntity>> unitsByFloorFinal = unitsByFloor;

            for (BuildingEntity building : buildings) {
                UUID projectId = building.getProjectId();
                UUID buildingId = building.getId();
                List<BuildingBlockEntity> buildingBlocks = blocksByBuilding.getOrDefault(buildingId, List.of());
                List<UUID> blockIds = buildingBlocks.stream().map(BuildingBlockEntity::getId).filter(Objects::nonNull).toList();
                List<FloorEntity> buildingFloors = blockIds.stream()
                    .flatMap(id -> floorsByBlockFinal.getOrDefault(id, List.of()).stream())
                    .toList();
                List<UUID> floorIds = buildingFloors.stream().map(FloorEntity::getId).filter(Objects::nonNull).toList();
                List<UnitEntity> buildingUnits = floorIds.stream()
                    .flatMap(id -> unitsByFloorFinal.getOrDefault(id, List.of()).stream())
                    .toList();

                Integer floorsMax = buildingBlocks.stream()
                    .map(BuildingBlockEntity::getFloorsCount)
                    .filter(Objects::nonNull)
                    .max(Integer::compareTo)
                    .orElse(0);

                List<Map<String, Object>> blocks = buildingBlocks.stream()
                    .filter(block -> !Boolean.TRUE.equals(block.getIsBasementBlock()))
                    .map(block -> {
                        Map<String, Object> mapped = new LinkedHashMap<>();
                        mapped.put("id", block.getId());
                        mapped.put("label", block.getLabel());
                        mapped.put("type", block.getType());
                        mapped.put("floorsCount", block.getFloorsCount() == null || block.getFloorsCount() == 0 ? null : block.getFloorsCount());
                        mapped.put("geometry", block.getFootprintGeojson());
                        return mapped;
                    })
                    .toList();

                Map<String, Object> mappedBuilding = new LinkedHashMap<>();
                mappedBuilding.put("id", buildingId);
                mappedBuilding.put("label", building.getLabel());
                mappedBuilding.put("buildingCode", building.getBuildingCode());
                mappedBuilding.put("houseNumber", building.getHouseNumber());
                mappedBuilding.put("house_number", building.getHouseNumber());
                mappedBuilding.put("category", building.getCategory());
                mappedBuilding.put("blocksCount", blocks.size());
                mappedBuilding.put("floorsMax", floorsMax == 0 ? null : floorsMax);
                mappedBuilding.put("unitsCount", buildingUnits.size());
                mappedBuilding.put("apartmentsCount", buildingUnits.stream().filter(unit -> "apartment".equals(String.valueOf(unit.getUnitType()))).count());
                mappedBuilding.put("address", building.getHouseNumber() == null ? null : "д. " + building.getHouseNumber());
                mappedBuilding.put("blocks", blocks);
                mappedBuilding.put("geometry", building.getFootprintGeojson());

                buildingsByProject.computeIfAbsent(projectId, key -> new ArrayList<>()).add(mappedBuilding);
            }
        }

        Map<UUID, String> applicationStatusByProject = new LinkedHashMap<>();
        for (ApplicationEntity application : applications) {
            UUID projectId = application.getProjectId();
            if (projectId != null && !applicationStatusByProject.containsKey(projectId)) {
                applicationStatusByProject.put(projectId, application.getStatus());
            }
        }

        List<Map<String, Object>> items = projects.stream().map(project -> {
            UUID projectId = project.getId();
            List<Map<String, Object>> projectBuildings = buildingsByProject.getOrDefault(projectId, List.of());
            Map<String, Long> categoryStats = projectBuildings.stream()
                .collect(Collectors.groupingBy(
                    building -> String.valueOf(building.getOrDefault("category", "unknown")),
                    LinkedHashMap::new,
                    Collectors.counting()
                ));

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", projectId);
            result.put("ujCode", project.getUjCode());
            result.put("name", project.getName());
            result.put("address", project.getAddress());
            result.put("status", applicationStatusByProject.getOrDefault(projectId, project.getConstructionStatus()));
            result.put("totalBuildings", projectBuildings.size());
            result.put("buildingTypeStats", categoryStats.entrySet().stream().map(entry -> Map.of("category", entry.getKey(), "count", entry.getValue())).toList());
            result.put("landPlotGeometry", project.getLandPlotGeojson());
            result.put("buildings", projectBuildings);
            return result;
        }).toList();

        return Map.of("items", items);
    }
}
