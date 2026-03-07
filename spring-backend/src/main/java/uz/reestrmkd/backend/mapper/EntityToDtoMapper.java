package uz.reestrmkd.backend.mapper;

import com.fasterxml.jackson.databind.ObjectMapper;

import uz.reestrmkd.backend.domain.project.api.ProjectContextResponseDto;
import uz.reestrmkd.backend.domain.project.api.ProjectDbDto;
import uz.reestrmkd.backend.domain.project.api.ProjectDocumentDbDto;
import uz.reestrmkd.backend.domain.project.api.ProjectParticipantDbDto;
import uz.reestrmkd.backend.domain.project.model.ProjectDocumentEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectParticipantEntity;
import uz.reestrmkd.backend.domain.registry.api.BlockConstructionDbDto;
import uz.reestrmkd.backend.domain.registry.api.BlockEngineeringDbDto;
import uz.reestrmkd.backend.domain.registry.api.BlockExtensionDbDto;
import uz.reestrmkd.backend.domain.registry.api.BlockFloorMarkerDbDto;
import uz.reestrmkd.backend.domain.registry.api.BuildingBlockDbDto;
import uz.reestrmkd.backend.domain.registry.api.BuildingDbDto;
import uz.reestrmkd.backend.domain.registry.model.BlockConstructionEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockEngineeringEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockExtensionEntity;
import uz.reestrmkd.backend.domain.registry.model.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingBlockEntity;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.workflow.api.ApplicationDbDto;
import uz.reestrmkd.backend.domain.workflow.api.ApplicationHistoryDbDto;
import uz.reestrmkd.backend.domain.workflow.api.ApplicationStepDbDto;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationHistoryEntity;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationStepEntity;

import java.util.*;
import java.util.stream.Collectors;

public final class EntityToDtoMapper {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private EntityToDtoMapper() {}

    public static ProjectContextResponseDto toProjectContext(
        ProjectEntity project,
        ApplicationEntity application,
        List<ProjectParticipantEntity> participants,
        List<ProjectDocumentEntity> documents,
        List<BuildingEntity> buildings,
        List<BuildingBlockEntity> blocks,
        List<BlockConstructionEntity> constructions,
        List<BlockEngineeringEntity> engineering,
        List<BlockFloorMarkerEntity> markers,
        List<BlockExtensionEntity> extensions,
        List<ApplicationHistoryEntity> history,
        List<ApplicationStepEntity> steps
    ) {
        Map<UUID, List<BuildingBlockEntity>> blocksByBuilding = blocks.stream().collect(Collectors.groupingBy(BuildingBlockEntity::getBuildingId));
        Map<UUID, List<BlockConstructionEntity>> consByBlock = constructions.stream().collect(Collectors.groupingBy(BlockConstructionEntity::getBlockId));
        Map<UUID, List<BlockEngineeringEntity>> engByBlock = engineering.stream().collect(Collectors.groupingBy(BlockEngineeringEntity::getBlockId));
        Map<UUID, List<BlockFloorMarkerEntity>> markersByBlock = markers.stream().collect(Collectors.groupingBy(BlockFloorMarkerEntity::getBlockId));
        Map<UUID, List<BlockExtensionEntity>> extByBlock = extensions.stream().collect(Collectors.groupingBy(BlockExtensionEntity::getParentBlockId));

        List<BuildingDbDto> buildingDtos = buildings.stream().map(b -> {
            List<BuildingBlockDbDto> blockDtos = blocksByBuilding.getOrDefault(b.getId(), List.of()).stream()
                .map(block -> toBuildingBlockDto(
                    block,
                    consByBlock.getOrDefault(block.getId(), List.of()),
                    engByBlock.getOrDefault(block.getId(), List.of()),
                    markersByBlock.getOrDefault(block.getId(), List.of()),
                    extByBlock.getOrDefault(block.getId(), List.of())
                ))
                .toList();
            return toBuildingDto(b, blockDtos);
        }).toList();

        return new ProjectContextResponseDto(
            toProjectDto(project),
            application == null ? null : toApplicationDto(application),
            participants.stream().map(EntityToDtoMapper::toParticipantDto).toList(),
            documents.stream().map(EntityToDtoMapper::toDocumentDto).toList(),
            buildingDtos,
            history.stream().map(EntityToDtoMapper::toHistoryDto).toList(),
            steps.stream().map(EntityToDtoMapper::toStepDto).toList(),
            markers.stream().map(EntityToDtoMapper::toMarkerDto).toList(),
            extensions.stream().map(EntityToDtoMapper::toExtensionDto).toList()
        );
    }

    public static ProjectDbDto toProjectDto(ProjectEntity e) {
        Map<String, Object> integrationData = e.getIntegrationData() == null ? Map.of() : e.getIntegrationData();
        return new ProjectDbDto(
            e.getId(),
            e.getScopeId(),
            e.getUjCode(),
            e.getName(),
            e.getRegion(),
            e.getDistrict(),
            e.getAddress(),
            asString(integrationData.get("regionSoato")),
            asString(integrationData.get("districtSoato")),
            asString(integrationData.get("streetId")),
            asString(integrationData.get("mahallaId")),
            asString(integrationData.get("mahalla")),
            asString(integrationData.get("buildingNo")),
            e.getLandmark(),
            e.getCadastreNumber(),
            e.getConstructionStatus(),
            e.getDateStartProject(),
            e.getDateEndProject(),
            e.getDateStartFact(),
            e.getDateEndFact(),
            integrationData,
            e.getAddressId(),
            e.getLandPlotGeojson(),
            e.getLandPlotAreaM2(),
            e.getCreatedAt(),
            e.getUpdatedAt()
        );
    }

    private static String asString(Object value) {
        if (value == null) return null;
        String parsed = String.valueOf(value).trim();
        return parsed.isBlank() ? null : parsed;
    }

    public static ApplicationDbDto toApplicationDto(ApplicationEntity e) {
        return new ApplicationDbDto(e.getId(), e.getProjectId(), e.getScopeId(), e.getInternalNumber(), e.getExternalSource(), e.getExternalId(),
            e.getApplicant(), e.getSubmissionDate(), e.getAssigneeName(), e.getStatus(), e.getWorkflowSubstatus(), e.getCurrentStep(),
            e.getCurrentStage(), e.getIntegrationData(), e.getRequestedDeclineReason(), e.getRequestedDeclineStep(),
            e.getRequestedDeclineBy(), e.getRequestedDeclineAt(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public static ApplicationHistoryDbDto toHistoryDto(ApplicationHistoryEntity e) {
        return new ApplicationHistoryDbDto(e.getId(), e.getApplicationId(), e.getAction(), e.getPrevStatus(), e.getNextStatus(), e.getUserName(), e.getComment(), e.getCreatedAt());
    }

    public static ApplicationStepDbDto toStepDto(ApplicationStepEntity e) {
        return new ApplicationStepDbDto(e.getId(), e.getApplicationId(), e.getStepIndex(), e.getIsCompleted(), e.getIsVerified(), e.getBlockStatuses(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public static ProjectParticipantDbDto toParticipantDto(ProjectParticipantEntity e) {
        return new ProjectParticipantDbDto(e.getId(), e.getProjectId(), e.getRole(), e.getName(), e.getInn(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public static ProjectDocumentDbDto toDocumentDto(ProjectDocumentEntity e) {
        return new ProjectDocumentDbDto(e.getId(), e.getProjectId(), e.getName(), e.getDocType(), e.getDocDate(), e.getDocNumber(), e.getFileUrl(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public static BuildingDbDto toBuildingDto(BuildingEntity e, List<BuildingBlockDbDto> blocks) {
        return new BuildingDbDto(e.getId(), e.getProjectId(), e.getBuildingCode(), e.getLabel(), e.getHouseNumber(), e.getAddressId(), e.getCategory(),
            e.getStage(), e.getDateStart(), e.getDateEnd(), e.getConstructionType(), e.getParkingType(), e.getInfraType(), e.getHasNonResPart(),
            e.getCadastreNumber(), OBJECT_MAPPER.valueToTree(e.getFootprintGeojson()), e.getBuildingFootprintAreaM2(), e.getGeometryCandidateId(), e.getCreatedAt(), e.getUpdatedAt(), blocks);
    }

    public static BuildingBlockDbDto toBuildingBlockDto(BuildingBlockEntity b, List<BlockConstructionEntity> c, List<BlockEngineeringEntity> e,
                                                         List<BlockFloorMarkerEntity> m, List<BlockExtensionEntity> x) {
        return new BuildingBlockDbDto(
            b.getId(), b.getBuildingId(), b.getLabel(), b.getType(), b.getFloorsCount(), b.getFloorsFrom(), b.getFloorsTo(), b.getEntrancesCount(),
            b.getElevatorsCount(), b.getVehicleEntries(), b.getLevelsDepth(), b.getLightStructureType(), b.getParentBlocks(), b.getIsBasementBlock(),
            b.getLinkedBlockIds(), b.getBasementDepth(), b.getBasementHasParking(), OBJECT_MAPPER.valueToTree(b.getBasementParkingLevels()), OBJECT_MAPPER.valueToTree(b.getBasementCommunications()),
            b.getHasBasement(), b.getHasAttic(), b.getHasLoft(), b.getHasRoofExpl(), b.getHasCustomAddress(), b.getCustomHouseNumber(), b.getAddressId(),
            OBJECT_MAPPER.valueToTree(b.getFootprintGeojson()), b.getBlockFootprintAreaM2(), b.getCreatedAt(), b.getUpdatedAt(),
            c.stream().map(EntityToDtoMapper::toConstructionDto).toList(),
            e.stream().map(EntityToDtoMapper::toEngineeringDto).toList(),
            m.stream().map(EntityToDtoMapper::toMarkerDto).toList(),
            x.stream().map(EntityToDtoMapper::toExtensionDto).toList()
        );
    }

    public static BlockConstructionDbDto toConstructionDto(BlockConstructionEntity e) {
        return new BlockConstructionDbDto(e.getId(), e.getBlockId(), e.getFoundation(), e.getWalls(), e.getSlabs(), e.getRoof(), e.getSeismicity(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public static BlockEngineeringDbDto toEngineeringDto(BlockEngineeringEntity e) {
        return new BlockEngineeringDbDto(e.getId(), e.getBlockId(), e.getHasElectricity(), e.getHasWater(), e.getHasHotWater(), e.getHasSewerage(), e.getHasGas(),
            e.getHasHeatingLocal(), e.getHasHeatingCentral(), e.getHasHeating(), e.getHasVentilation(), e.getHasFirefighting(), e.getHasLowcurrent(),
            e.getHasInternet(), e.getHasSolarPanels(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public static BlockFloorMarkerDbDto toMarkerDto(BlockFloorMarkerEntity e) {
        return new BlockFloorMarkerDbDto(e.getId(), e.getBlockId(), e.getMarkerKey(), e.getFloorIndex(), e.getIsTechnical(), e.getIsCommercial(), e.getCreatedAt(), e.getUpdatedAt());
    }

    public static BlockExtensionDbDto toExtensionDto(BlockExtensionEntity e) {
        return new BlockExtensionDbDto(e.getId(), e.getBuildingId(), e.getParentBlockId(), e.getLabel(), e.getExtensionType(), e.getConstructionKind(), e.getFloorsCount(),
            e.getStartFloorIndex(), e.getVerticalAnchorType(), e.getAnchorFloorKey(), e.getNotes(), e.getCreatedAt(), e.getUpdatedAt());
    }
}
