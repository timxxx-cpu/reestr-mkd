package uz.reestrmkd.backend.domain.project.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.api.GeometryCandidateImportItemDto;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectGeometryCandidateEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectGeometryCandidateJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.registry.api.GeometryCandidateResponseDto;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ProjectGeometryService {

    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    private final ProjectGeometryCandidateJpaRepository projectGeometryCandidateJpaRepository;
    private final ProjectJpaRepository projectJpaRepository;
    private final BuildingJpaRepository buildingJpaRepository;
    private final ObjectMapper objectMapper;

    public ProjectGeometryService(
        ProjectGeometryCandidateJpaRepository projectGeometryCandidateJpaRepository,
        ProjectJpaRepository projectJpaRepository,
        BuildingJpaRepository buildingJpaRepository,
        ObjectMapper objectMapper
    ) {
        this.projectGeometryCandidateJpaRepository = projectGeometryCandidateJpaRepository;
        this.projectJpaRepository = projectJpaRepository;
        this.buildingJpaRepository = buildingJpaRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<GeometryCandidateResponseDto> getCandidates(UUID projectId) {
        return projectGeometryCandidateJpaRepository.findByProjectIdOrderBySourceIndexAscIdAsc(projectId).stream()
            .map(this::toCandidateDto)
            .toList();
    }

    @Transactional
    public int importCandidates(UUID projectId, List<GeometryCandidateImportItemDto> candidates) {
        int imported = 0;
        int defaultIndex = 100;

        for (GeometryCandidateImportItemDto candidate : candidates) {
            if (candidate.geometry() == null || candidate.geometry().isNull()) {
                continue;
            }
            try {
                String geojsonStr = asJson(candidate.geometry());
                String propertiesStr = asJson(candidate.properties() == null ? objectMapper.createObjectNode() : candidate.properties());
                boolean changed = projectGeometryCandidateJpaRepository.upsertGeometryCandidate(
                    projectId,
                    candidate.sourceIndex() == null ? defaultIndex++ : candidate.sourceIndex(),
                    candidate.label(),
                    propertiesStr,
                    geojsonStr
                );
                if (changed) {
                    imported += 1;
                }
            } catch (Exception e) {
                throw new ApiException("Geometry import failed: " + e.getMessage(), "GEOMETRY_IMPORT_ERROR", e.getMessage(), 400);
            }
        }
        return imported;
    }

    @Transactional
    public void selectLand(UUID projectId, UUID candidateId) {
        ProjectGeometryCandidateEntity candidate = projectGeometryCandidateJpaRepository.findByIdAndProjectId(candidateId, projectId)
            .orElseThrow(() -> new ApiException("Candidate not found", "NOT_FOUND", null, 404));
        ProjectEntity project = projectJpaRepository.findById(projectId)
            .orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));

        Instant now = Instant.now();
        List<ProjectGeometryCandidateEntity> candidates = projectGeometryCandidateJpaRepository.findByProjectId(projectId);
        for (ProjectGeometryCandidateEntity item : candidates) {
            item.setIsSelectedLandPlot(item.getId().equals(candidateId));
            item.setUpdatedAt(now);
        }
        projectGeometryCandidateJpaRepository.saveAll(candidates);

        String geojson = asJson(candidate.getGeometry());
        project.setLandPlotGeojson(objectMapper.convertValue(candidate.getGeometry(), MAP_TYPE));
        project.setLandPlotAreaM2(candidate.getAreaM2());
        project.setUpdatedAt(now);
        projectJpaRepository.save(project);

        projectJpaRepository.updateLandPlotGeom(projectId, geojson);
    }

    @Transactional
    public void unselectLand(UUID projectId) {
        Instant now = Instant.now();
        List<ProjectGeometryCandidateEntity> candidates = projectGeometryCandidateJpaRepository.findByProjectId(projectId);
        for (ProjectGeometryCandidateEntity item : candidates) {
            item.setIsSelectedLandPlot(false);
            item.setUpdatedAt(now);
        }
        if (!candidates.isEmpty()) {
            projectGeometryCandidateJpaRepository.saveAll(candidates);
        }

        projectJpaRepository.findById(projectId).ifPresent(project -> {
            project.setLandPlotGeojson(null);
            project.setLandPlotAreaM2(null);
            project.setUpdatedAt(now);
            projectJpaRepository.save(project);
        });

        projectJpaRepository.clearLandPlotGeom(projectId);
    }

    @Transactional
    public void deleteCandidate(UUID projectId, UUID candidateId) {
        ProjectGeometryCandidateEntity candidate = projectGeometryCandidateJpaRepository.findByIdAndProjectId(candidateId, projectId)
            .orElseThrow(() -> new ApiException("Geometry candidate not found", "NOT_FOUND", null, 404));
        Instant now = Instant.now();

        if (candidate.getAssignedBuildingId() != null) {
            buildingJpaRepository.findById(candidate.getAssignedBuildingId())
                .filter(building -> projectId.equals(building.getProjectId()))
                .ifPresent(building -> clearBuildingGeometry(building, now));
            buildingJpaRepository.clearBuildingFootprintGeom(candidate.getAssignedBuildingId(), projectId);
        }

        if (Boolean.TRUE.equals(candidate.getIsSelectedLandPlot())) {
            projectJpaRepository.findById(projectId).ifPresent(project -> {
                project.setLandPlotGeojson(null);
                project.setLandPlotAreaM2(null);
                project.setUpdatedAt(now);
                projectJpaRepository.save(project);
            });
            projectJpaRepository.clearLandPlotGeom(projectId);
        }

        projectGeometryCandidateJpaRepository.delete(candidate);
    }

    @Transactional
    public void selectBuildingGeometry(UUID projectId, UUID buildingId, UUID candidateId) {
        BuildingEntity building = buildingJpaRepository.findById(buildingId)
            .filter(item -> projectId.equals(item.getProjectId()))
            .orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        Instant now = Instant.now();

        if (candidateId == null) {
            clearAssignedBuildingCandidates(projectId, buildingId, null, now);
            clearBuildingGeometry(building, now);
            buildingJpaRepository.clearBuildingFootprintGeom(buildingId, projectId);
            return;
        }

        ProjectGeometryCandidateEntity candidate = projectGeometryCandidateJpaRepository.findByIdAndProjectId(candidateId, projectId)
            .orElseThrow(() -> new ApiException("Candidate not found", "NOT_FOUND", null, 404));
        String geojson = asJson(candidate.getGeometry());

        Boolean hasLandPlot = projectJpaRepository.hasLandPlotGeom(projectId);
        if (!Boolean.TRUE.equals(hasLandPlot)) {
            throw new ApiException("Land plot is not selected", "VALIDATION_ERROR", null, 400);
        }

        Boolean covered = projectJpaRepository.isGeometryCoveredByLandPlot(projectId, geojson);
        if (!Boolean.TRUE.equals(covered)) {
            throw new ApiException("Building geometry must be within land plot", "VALIDATION_ERROR", null, 400);
        }

        Boolean intersects = buildingJpaRepository.intersectsExistingBuildingGeometry(projectId, buildingId, geojson);
        if (Boolean.TRUE.equals(intersects)) {
            throw new ApiException("Building geometry intersects another building", "VALIDATION_ERROR", null, 400);
        }

        building.setFootprintGeojson(objectMapper.convertValue(candidate.getGeometry(), MAP_TYPE));
        building.setBuildingFootprintAreaM2(candidate.getAreaM2());
        building.setGeometryCandidateId(candidateId);
        building.setUpdatedAt(now);
        buildingJpaRepository.save(building);

        buildingJpaRepository.updateBuildingFootprintGeom(buildingId, projectId, geojson);

        clearAssignedBuildingCandidates(projectId, buildingId, candidateId, now);
    }

    private void clearAssignedBuildingCandidates(UUID projectId, UUID buildingId, UUID keepCandidateId, Instant now) {
        List<ProjectGeometryCandidateEntity> candidates = projectGeometryCandidateJpaRepository.findByProjectId(projectId);
        List<ProjectGeometryCandidateEntity> changed = candidates.stream()
            .filter(candidate -> buildingId.equals(candidate.getAssignedBuildingId()) || candidate.getId().equals(keepCandidateId))
            .peek(candidate -> {
                candidate.setAssignedBuildingId(candidate.getId().equals(keepCandidateId) ? buildingId : null);
                candidate.setUpdatedAt(now);
            })
            .toList();
        if (!changed.isEmpty()) {
            projectGeometryCandidateJpaRepository.saveAll(changed);
        }
    }

    private void clearBuildingGeometry(BuildingEntity building, Instant now) {
        building.setGeometryCandidateId(null);
        building.setFootprintGeojson(null);
        building.setBuildingFootprintAreaM2(null);
        building.setUpdatedAt(now);
        buildingJpaRepository.save(building);
    }

    private GeometryCandidateResponseDto toCandidateDto(ProjectGeometryCandidateEntity entity) {
        return new GeometryCandidateResponseDto(
            entity.getId(),
            entity.getSourceIndex(),
            entity.getLabel(),
            entity.getProperties(),
            entity.getGeometry(),
            entity.getAreaM2(),
            entity.getIsSelectedLandPlot(),
            entity.getAssignedBuildingId()
        );
    }

    private String asJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw new ApiException("Geometry serialization failed", "GEOMETRY_ASSIGN_ERROR", e.getMessage(), 400);
        }
    }
}
