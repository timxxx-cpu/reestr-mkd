package uz.reestrmkd.backend.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.dto.ProjectContextResponseDto;
import uz.reestrmkd.backend.entity.ApplicationEntity;
import uz.reestrmkd.backend.entity.BuildingEntity;
import uz.reestrmkd.backend.entity.ProjectEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.mapper.EntityToDtoMapper;
import uz.reestrmkd.backend.repository.*;

import java.util.List;
import java.util.UUID;

@Service
public class ProjectContextService {

    private final ProjectJpaRepository projectRepo;
    private final ApplicationJpaRepository applicationRepo;
    private final ProjectParticipantJpaRepository participantRepo;
    private final ProjectDocumentJpaRepository documentRepo;
    private final BuildingJpaRepository buildingRepo;
    private final BuildingBlockJpaRepository blockRepo;
    private final BlockConstructionJpaRepository constructionRepo;
    private final BlockEngineeringJpaRepository engineeringRepo;
    private final BlockFloorMarkerJpaRepository markerRepo;
    private final BlockExtensionJpaRepository extensionRepo;
    private final ApplicationHistoryJpaRepository historyRepo;
    private final ApplicationStepJpaRepository stepRepo;

    public ProjectContextService(
        ProjectJpaRepository projectRepo,
        ApplicationJpaRepository applicationRepo,
        ProjectParticipantJpaRepository participantRepo,
        ProjectDocumentJpaRepository documentRepo,
        BuildingJpaRepository buildingRepo,
        BuildingBlockJpaRepository blockRepo,
        BlockConstructionJpaRepository constructionRepo,
        BlockEngineeringJpaRepository engineeringRepo,
        BlockFloorMarkerJpaRepository markerRepo,
        BlockExtensionJpaRepository extensionRepo,
        ApplicationHistoryJpaRepository historyRepo,
        ApplicationStepJpaRepository stepRepo
    ) {
        this.projectRepo = projectRepo;
        this.applicationRepo = applicationRepo;
        this.participantRepo = participantRepo;
        this.documentRepo = documentRepo;
        this.buildingRepo = buildingRepo;
        this.blockRepo = blockRepo;
        this.constructionRepo = constructionRepo;
        this.engineeringRepo = engineeringRepo;
        this.markerRepo = markerRepo;
        this.extensionRepo = extensionRepo;
        this.historyRepo = historyRepo;
        this.stepRepo = stepRepo;
    }

    public ProjectContextResponseDto getProjectContext(UUID projectId, String scope) {
        ProjectEntity project = projectRepo.findByIdAndScope(projectId, scope)
            .orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));

        ApplicationEntity app = applicationRepo.findByProjectIdAndScopeId(projectId, scope)
            .orElse(null);

        var participants = participantRepo.findByProjectId(projectId);
        var documents = documentRepo.findByProjectId(projectId);

        List<BuildingEntity> buildings = buildingRepo.findByProjectIdOrderByCreatedAtAsc(projectId);
        List<UUID> buildingIds = buildings.stream().map(BuildingEntity::getId).toList();

        List<uz.reestrmkd.backend.entity.BuildingBlockEntity> blocks = buildingIds.isEmpty() ? java.util.Collections.emptyList() : blockRepo.findByBuildingIdIn(buildingIds);
        List<UUID> blockIds = blocks.stream().map(b -> b.getId()).toList();

        List<uz.reestrmkd.backend.entity.BlockConstructionEntity> constructions = blockIds.isEmpty() ? java.util.Collections.emptyList() : constructionRepo.findByBlockIdIn(blockIds);
        List<uz.reestrmkd.backend.entity.BlockEngineeringEntity> engineering = blockIds.isEmpty() ? java.util.Collections.emptyList() : engineeringRepo.findByBlockIdIn(blockIds);
        List<uz.reestrmkd.backend.entity.BlockFloorMarkerEntity> markers = blockIds.isEmpty() ? java.util.Collections.emptyList() : markerRepo.findByBlockIdIn(blockIds);
        List<uz.reestrmkd.backend.entity.BlockExtensionEntity> extensions = blockIds.isEmpty() ? java.util.Collections.emptyList() : extensionRepo.findByParentBlockIdIn(blockIds);

        List<uz.reestrmkd.backend.entity.ApplicationHistoryEntity> history = app == null ? java.util.Collections.emptyList() : historyRepo.findByApplicationIdOrderByCreatedAtDesc(app.getId());
        List<uz.reestrmkd.backend.entity.ApplicationStepEntity> steps = app == null ? java.util.Collections.emptyList() : stepRepo.findAllByApplicationOrdered(app.getId());

        return EntityToDtoMapper.toProjectContext(
            project,
            app,
            participants,
            documents,
            buildings,
            blocks,
            constructions,
            engineering,
            markers,
            extensions,
            history,
            steps
        );
    }
}
