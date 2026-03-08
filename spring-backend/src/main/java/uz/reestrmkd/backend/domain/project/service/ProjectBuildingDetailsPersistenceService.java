package uz.reestrmkd.backend.domain.project.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.BlockConstructionEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockEngineeringEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockConstructionJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BlockEngineeringJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class ProjectBuildingDetailsPersistenceService {

    private final BuildingBlockJpaRepository buildingBlockJpaRepository;
    private final BlockConstructionJpaRepository blockConstructionJpaRepository;
    private final BlockEngineeringJpaRepository blockEngineeringJpaRepository;

    public ProjectBuildingDetailsPersistenceService(
        BuildingBlockJpaRepository buildingBlockJpaRepository,
        BlockConstructionJpaRepository blockConstructionJpaRepository,
        BlockEngineeringJpaRepository blockEngineeringJpaRepository
    ) {
        this.buildingBlockJpaRepository = buildingBlockJpaRepository;
        this.blockConstructionJpaRepository = blockConstructionJpaRepository;
        this.blockEngineeringJpaRepository = blockEngineeringJpaRepository;
    }

    @Transactional(readOnly = true)
    public List<UUID> findNonBasementBlockIds(UUID buildingId) {
        return buildingBlockJpaRepository.findByBuildingId(buildingId).stream()
            .filter(block -> !Boolean.TRUE.equals(block.getIsBasementBlock()))
            .map(BuildingBlockEntity::getId)
            .filter(Objects::nonNull)
            .toList();
    }

    @Transactional(readOnly = true)
    public void deleteMissingBasementBlocks(UUID buildingId, List<UUID> keepIds) {
        List<UUID> deleteIds = buildingBlockJpaRepository.findByBuildingId(buildingId).stream()
            .filter(block -> Boolean.TRUE.equals(block.getIsBasementBlock()))
            .map(BuildingBlockEntity::getId)
            .filter(Objects::nonNull)
            .filter(id -> keepIds == null || !keepIds.contains(id))
            .toList();
        if (!deleteIds.isEmpty()) {
            buildingBlockJpaRepository.deleteAllByIdInBatch(deleteIds);
        }
    }

    @Transactional
    public void saveBasementBlock(
        UUID buildingId,
        UUID blockId,
        String label,
        List<UUID> linkedBlockIds,
        int depth,
        boolean hasParking,
        Map<String, Object> parkingLevels,
        Map<String, Object> communications,
        int entrancesCount,
        Map<String, Object> footprintGeojson
    ) {
        Instant now = Instant.now();
        BuildingBlockEntity block = buildingBlockJpaRepository.findById(blockId).orElseGet(BuildingBlockEntity::new);
        block.setId(blockId);
        block.setBuildingId(buildingId);
        block.setLabel(label);
        block.setType("BAS");
        block.setIsBasementBlock(true);
        block.setLinkedBlockIds(linkedBlockIds == null || linkedBlockIds.isEmpty() ? new UUID[0] : linkedBlockIds.toArray(UUID[]::new));
        block.setBasementDepth(depth);
        block.setBasementHasParking(hasParking);
        block.setBasementParkingLevels(parkingLevels);
        block.setBasementCommunications(communications);
        block.setFloorsCount(0);
        block.setFloorsFrom(null);
        block.setFloorsTo(null);
        block.setEntrancesCount(entrancesCount);
        block.setElevatorsCount(0);
        block.setVehicleEntries(0);
        block.setLevelsDepth(0);
        block.setLightStructureType(null);
        block.setParentBlocks(new UUID[0]);
        block.setHasBasement(false);
        block.setHasAttic(false);
        block.setHasLoft(false);
        block.setHasRoofExpl(false);
        block.setHasCustomAddress(false);
        block.setCustomHouseNumber(null);
        if (footprintGeojson != null) {
            block.setFootprintGeojson(footprintGeojson);
        }
        if (block.getCreatedAt() == null) {
            block.setCreatedAt(now);
        }
        block.setUpdatedAt(now);
        buildingBlockJpaRepository.save(block);
    }

    @Transactional(readOnly = true)
    public UUID findBuildingIdByBlockId(UUID blockId) {
        return buildingBlockJpaRepository.findById(blockId)
            .map(BuildingBlockEntity::getBuildingId)
            .orElse(null);
    }

    @Transactional
    public void updateBlockDetails(
        UUID blockId,
        Integer floorsCount,
        Integer entrancesCount,
        Integer elevatorsCount,
        Integer vehicleEntries,
        Integer levelsDepth,
        String lightStructureType,
        List<UUID> parentBlocks,
        Integer floorsFrom,
        Integer floorsTo,
        Boolean hasBasement,
        Boolean hasAttic,
        Boolean hasLoft,
        Boolean hasRoofExpl,
        Boolean hasCustomAddress,
        String customHouseNumber,
        UUID addressId,
        Map<String, Object> footprintGeojson
    ) {
        BuildingBlockEntity block = requireBlock(blockId);
        block.setFloorsCount(floorsCount);
        block.setEntrancesCount(entrancesCount);
        block.setElevatorsCount(elevatorsCount);
        block.setVehicleEntries(vehicleEntries);
        block.setLevelsDepth(levelsDepth);
        block.setLightStructureType(lightStructureType);
        block.setParentBlocks(parentBlocks == null || parentBlocks.isEmpty() ? new UUID[0] : parentBlocks.toArray(UUID[]::new));
        block.setFloorsFrom(floorsFrom);
        block.setFloorsTo(floorsTo);
        block.setHasBasement(hasBasement);
        block.setHasAttic(hasAttic);
        block.setHasLoft(hasLoft);
        block.setHasRoofExpl(hasRoofExpl);
        block.setHasCustomAddress(hasCustomAddress);
        block.setCustomHouseNumber(customHouseNumber);
        block.setAddressId(addressId);
        if (footprintGeojson != null) {
            block.setFootprintGeojson(footprintGeojson);
        }
        block.setUpdatedAt(Instant.now());
        buildingBlockJpaRepository.save(block);
    }

    @Transactional
    public void upsertBlockConstruction(
        UUID blockId,
        String foundation,
        String walls,
        String slabs,
        String roof,
        Integer seismicity
    ) {
        Instant now = Instant.now();
        BlockConstructionEntity entity = blockConstructionJpaRepository.findByBlockId(blockId).orElseGet(BlockConstructionEntity::new);
        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setBlockId(blockId);
            entity.setCreatedAt(now);
        }
        entity.setFoundation(foundation);
        entity.setWalls(walls);
        entity.setSlabs(slabs);
        entity.setRoof(roof);
        entity.setSeismicity(seismicity);
        entity.setUpdatedAt(now);
        blockConstructionJpaRepository.save(entity);
    }

    @Transactional
    public void upsertBlockEngineering(
        UUID blockId,
        boolean hasElectricity,
        boolean hasWater,
        boolean hasHotWater,
        boolean hasVentilation,
        boolean hasFirefighting,
        boolean hasLowcurrent,
        boolean hasSewerage,
        boolean hasGas,
        boolean hasHeatingLocal,
        boolean hasHeatingCentral,
        boolean hasInternet,
        boolean hasSolarPanels
    ) {
        Instant now = Instant.now();
        BlockEngineeringEntity entity = blockEngineeringJpaRepository.findByBlockId(blockId).orElseGet(BlockEngineeringEntity::new);
        if (entity.getId() == null) {
            entity.setId(UUID.randomUUID());
            entity.setBlockId(blockId);
            entity.setCreatedAt(now);
        }
        entity.setHasElectricity(hasElectricity);
        entity.setHasWater(hasWater);
        entity.setHasHotWater(hasHotWater);
        entity.setHasVentilation(hasVentilation);
        entity.setHasFirefighting(hasFirefighting);
        entity.setHasLowcurrent(hasLowcurrent);
        entity.setHasSewerage(hasSewerage);
        entity.setHasGas(hasGas);
        entity.setHasHeatingLocal(hasHeatingLocal);
        entity.setHasHeatingCentral(hasHeatingCentral);
        entity.setHasInternet(hasInternet);
        entity.setHasSolarPanels(hasSolarPanels);
        entity.setHasHeating(hasHeatingLocal || hasHeatingCentral);
        entity.setUpdatedAt(now);
        blockEngineeringJpaRepository.save(entity);
    }

    private BuildingBlockEntity requireBlock(UUID blockId) {
        return buildingBlockJpaRepository.findById(blockId)
            .orElseThrow(() -> new ApiException("Block not found", "NOT_FOUND", null, 404));
    }
}
