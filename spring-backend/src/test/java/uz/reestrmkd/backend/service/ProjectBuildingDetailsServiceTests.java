package uz.reestrmkd.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.project.service.ProjectBuildingDetailsPersistenceService;
import uz.reestrmkd.backend.domain.project.service.ProjectBuildingDetailsService;
import uz.reestrmkd.backend.domain.registry.api.BuildingDetailsSaveRequestDto;
import uz.reestrmkd.backend.domain.registry.model.BuildingEntity;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.BlockFloorMarkerSyncService;
import uz.reestrmkd.backend.domain.registry.service.EntranceMatrixEnsureService;
import uz.reestrmkd.backend.domain.registry.service.EntranceReconcileService;
import uz.reestrmkd.backend.domain.registry.service.FloorsReconcileService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectBuildingDetailsServiceTests {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private BuildingJpaRepository buildingJpaRepository;
    @Mock
    private FloorsReconcileService floorsReconcileService;
    @Mock
    private EntranceReconcileService entranceReconcileService;
    @Mock
    private EntranceMatrixEnsureService entranceMatrixEnsureService;
    @Mock
    private BlockFloorMarkerSyncService blockFloorMarkerSyncService;
    @Mock
    private ProjectBuildingDetailsPersistenceService projectBuildingDetailsPersistenceService;

    @Test
    void shouldPersistBasementFeaturesViaService() {
        ProjectBuildingDetailsService service = service();
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID targetBlockId = UUID.randomUUID();
        UUID basementId = UUID.randomUUID();

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setCategory("residential");

        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(building));
        when(projectBuildingDetailsPersistenceService.findNonBasementBlockIds(buildingId)).thenReturn(List.of(targetBlockId));

        BuildingDetailsSaveRequestDto payload = new BuildingDetailsSaveRequestDto(Map.of(
            buildingId + "_features",
            objectMapper.valueToTree(Map.of(
                "basements",
                List.of(Map.of(
                    "id", basementId.toString(),
                    "depth", 2,
                    "entrancesCount", 2,
                    "hasParking", true,
                    "parkingLevels", Map.of("1", true),
                    "communications", Map.of("water", true),
                    "blockGeometry", Map.of("type", "Polygon", "coordinates", List.of(List.of()))
                ))
            ))
        ));

        Map<String, Object> response = service.saveBuildingDetails(projectId, payload);

        verify(projectBuildingDetailsPersistenceService).saveBasementBlock(
            eq(buildingId),
            eq(basementId),
            eq("\u041F\u043E\u0434\u0432\u0430\u043B 1"),
            eq(List.of(targetBlockId)),
            eq(2),
            eq(true),
            anyMap(),
            anyMap(),
            eq(2),
            anyMap()
        );
        verify(floorsReconcileService).reconcile(basementId);
        verify(entranceReconcileService).reconcile(basementId, 2);
        verify(entranceMatrixEnsureService).ensureForBlock(basementId);
        verify(projectBuildingDetailsPersistenceService).deleteMissingBasementBlocks(buildingId, List.of(basementId));
        assertThat(response).containsEntry("ok", true);
        assertThat(response).containsEntry("projectId", projectId);
    }

    @Test
    void shouldPersistRegularBlockDetailsViaService() {
        ProjectBuildingDetailsService service = service();
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setFootprintGeojson(Map.of("type", "MultiPolygon", "coordinates", List.of()));

        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(building));
        when(projectBuildingDetailsPersistenceService.findBuildingIdByBlockId(blockId)).thenReturn(buildingId);
        when(buildingJpaRepository.calculateOutsideRatio(anyString(), anyString())).thenReturn(0.0d);

        BuildingDetailsSaveRequestDto payload = new BuildingDetailsSaveRequestDto(Map.of(
            "block_" + blockId,
            objectMapper.valueToTree(Map.ofEntries(
                Map.entry("floorsCount", 9),
                Map.entry("entrances", 2),
                Map.entry("elevators", 1),
                Map.entry("vehicleEntries", 1),
                Map.entry("levelsDepth", 0),
                Map.entry("lightStructureType", "frame"),
                Map.entry("parentBlocks", List.of()),
                Map.entry("floorsFrom", 1),
                Map.entry("floorsTo", 9),
                Map.entry("hasBasementFloor", false),
                Map.entry("hasAttic", false),
                Map.entry("hasLoft", false),
                Map.entry("hasExploitableRoof", true),
                Map.entry("hasCustomAddress", false),
                Map.entry("customHouseNumber", ""),
                Map.entry("blockGeometry", Map.of("type", "Polygon", "coordinates", List.of(List.of()))),
                Map.entry("foundation", "pile"),
                Map.entry("walls", "brick"),
                Map.entry("slabs", "monolith"),
                Map.entry("roof", "flat"),
                Map.entry("seismicity", 8),
                Map.entry("engineering", Map.ofEntries(
                    Map.entry("electricity", true),
                    Map.entry("hvs", true),
                    Map.entry("gvs", false),
                    Map.entry("ventilation", true),
                    Map.entry("firefighting", false),
                    Map.entry("lowcurrent", true),
                    Map.entry("sewerage", true),
                    Map.entry("gas", false),
                    Map.entry("heatingLocal", true),
                    Map.entry("heatingCentral", false),
                    Map.entry("internet", true),
                    Map.entry("solarPanels", false)
                ))
            ))
        ));

        service.saveBuildingDetails(projectId, payload);

        verify(projectBuildingDetailsPersistenceService).updateBlockDetails(
            eq(blockId),
            eq(9),
            eq(2),
            eq(1),
            eq(1),
            eq(0),
            eq("frame"),
            anyList(),
            eq(1),
            eq(9),
            eq(false),
            eq(false),
            eq(false),
            eq(true),
            eq(false),
            isNull(),
            isNull(),
            anyMap()
        );
        verify(blockFloorMarkerSyncService).sync(eq(blockId), anyMap());
        verify(floorsReconcileService).reconcile(blockId);
        verify(entranceReconcileService).reconcile(blockId, 2);
        verify(entranceMatrixEnsureService).ensureForBlock(blockId);
        verify(projectBuildingDetailsPersistenceService).upsertBlockConstruction(blockId, "pile", "brick", "monolith", "flat", 8);
        verify(projectBuildingDetailsPersistenceService).upsertBlockEngineering(
            blockId,
            true,
            true,
            false,
            true,
            false,
            true,
            true,
            false,
            true,
            false,
            true,
            false
        );
    }

    private ProjectBuildingDetailsService service() {
        return new ProjectBuildingDetailsService(
            buildingJpaRepository,
            floorsReconcileService,
            entranceReconcileService,
            entranceMatrixEnsureService,
            blockFloorMarkerSyncService,
            projectBuildingDetailsPersistenceService,
            objectMapper
        );
    }
}
