package uz.reestrmkd.backend.service;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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
import uz.reestrmkd.backend.domain.registry.service.CompositionBuildingService;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CompositionBuildingServiceTests {

    @Mock
    private AddressJpaRepository addressJpaRepository;
    @Mock
    private ProjectGeometryCandidateJpaRepository projectGeometryCandidateJpaRepository;
    @Mock
    private ProjectJpaRepository projectJpaRepository;
    @Mock
    private BuildingJpaRepository buildingJpaRepository;
    @Mock
    private BuildingBlockJpaRepository buildingBlockJpaRepository;
    @Mock
    private BlockExtensionJpaRepository blockExtensionJpaRepository;

    @InjectMocks
    private CompositionBuildingService service;

    @Test
    void shouldLoadBuildingsFromJpaRepositories() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();
        UUID extensionId = UUID.randomUUID();

        BuildingEntity building = new BuildingEntity();
        building.setId(buildingId);
        building.setProjectId(projectId);
        building.setLabel("Building A");
        building.setCategory("residential");
        building.setBuildingCode("UJ000001-ZR01");

        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(blockId);
        block.setBuildingId(buildingId);
        block.setLabel("Block 1");
        block.setType("\u0416");
        block.setFloorsCount(9);

        BlockExtensionEntity extension = new BlockExtensionEntity();
        extension.setId(extensionId);
        extension.setParentBlockId(blockId);
        extension.setLabel("Ext");
        extension.setExtensionType("balcony");
        extension.setFloorsCount(2);

        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(building));
        when(buildingBlockJpaRepository.findByBuildingIdIn(List.of(buildingId))).thenReturn(List.of(block));
        when(blockExtensionJpaRepository.findByParentBlockIdIn(List.of(blockId))).thenReturn(List.of(extension));

        List<Map<String, Object>> result = service.loadBuildings(projectId);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst()).containsEntry("buildingCode", "UJ000001-ZR01");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> blocks = (List<Map<String, Object>>) result.getFirst().get("blocks");
        assertThat(blocks).hasSize(1);
        assertThat(blocks.getFirst()).containsEntry("type", "residential");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> extensions = (List<Map<String, Object>>) blocks.getFirst().get("extensions");
        assertThat(extensions).hasSize(1);
        assertThat(extensions.getFirst()).containsEntry("extensionType", "balcony");
    }

    @Test
    void shouldCreateBuildingUsingJpaAndAssignGeometry() {
        UUID projectId = UUID.randomUUID();
        UUID projectAddressId = UUID.randomUUID();
        UUID geometryCandidateId = UUID.randomUUID();
        UUID blockId = UUID.randomUUID();

        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setUjCode("UJ000001");
        project.setAddressId(projectAddressId);

        ProjectGeometryCandidateEntity candidate = new ProjectGeometryCandidateEntity();
        candidate.setId(geometryCandidateId);
        candidate.setProjectId(projectId);
        candidate.setGeometry(JsonNodeFactory.instance.objectNode().put("type", "Polygon"));
        candidate.setAreaM2(new BigDecimal("120"));

        AtomicReference<BuildingEntity> savedBuildingRef = new AtomicReference<>();

        BuildingEntity existing = new BuildingEntity();
        existing.setBuildingCode("UJ000001-ZR01");

        Map<String, Object> buildingData = new LinkedHashMap<>();
        buildingData.put("label", "Building A");
        buildingData.put("houseNumber", "10");
        buildingData.put("addressId", UUID.randomUUID().toString());
        buildingData.put("category", "residential");
        buildingData.put("hasNonResPart", false);
        buildingData.put("geometryCandidateId", geometryCandidateId.toString());
        buildingData.put("basementsCount", 0);

        Map<String, Object> blockData = new LinkedHashMap<>();
        blockData.put("id", blockId.toString());
        blockData.put("label", "Block 1");
        blockData.put("type", "residential");
        blockData.put("floorsCount", 9);

        when(projectJpaRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectGeometryCandidateJpaRepository.findByIdAndProjectId(geometryCandidateId, projectId)).thenReturn(Optional.of(candidate));
        when(projectGeometryCandidateJpaRepository.findByProjectIdAndAssignedBuildingIdAndIdNot(eq(projectId), any(UUID.class), eq(geometryCandidateId))).thenReturn(List.of());
        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of(existing));
        when(projectJpaRepository.hasLandPlotGeom(projectId)).thenReturn(true);
        when(projectJpaRepository.isGeometryCoveredByLandPlot(projectId, candidate.getGeometry().toString())).thenReturn(true);
        when(buildingJpaRepository.intersectsExistingBuildingGeometry(eq(projectId), any(UUID.class), eq(candidate.getGeometry().toString()))).thenReturn(false);
        when(buildingJpaRepository.updateGeometryAssignment(any(UUID.class), eq(projectId), eq(candidate.getGeometry().toString()), eq(candidate.getAreaM2()), eq(geometryCandidateId), any())).thenReturn(1);
        when(buildingJpaRepository.save(any(BuildingEntity.class))).thenAnswer(invocation -> {
            BuildingEntity saved = invocation.getArgument(0);
            savedBuildingRef.set(saved);
            return saved;
        });
        when(buildingJpaRepository.findById(any(UUID.class))).thenAnswer(invocation -> Optional.ofNullable(savedBuildingRef.get()));
        when(buildingBlockJpaRepository.findByBuildingId(any())).thenReturn(List.of(blockEntity(blockId)));
        when(projectGeometryCandidateJpaRepository.save(any(ProjectGeometryCandidateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> result = service.createBuilding(projectId, buildingData, List.of(blockData));

        assertThat(result).containsEntry("ok", true);
        ArgumentCaptor<BuildingEntity> buildingCaptor = ArgumentCaptor.forClass(BuildingEntity.class);
        verify(buildingJpaRepository).save(buildingCaptor.capture());
        assertThat(buildingCaptor.getValue().getBuildingCode()).isEqualTo("UJ000001-ZR02");

        ArgumentCaptor<List<BuildingBlockEntity>> blocksCaptor = blockListCaptor();
        verify(buildingBlockJpaRepository).saveAll(blocksCaptor.capture());
        assertThat(blocksCaptor.getValue()).hasSize(1);
        assertThat(blocksCaptor.getValue().getFirst().getType()).isEqualTo("\u0416");
    }

    @Test
    void shouldCloneProjectAddressWhenBuildingAddressMissing() {
        UUID projectId = UUID.randomUUID();
        UUID projectAddressId = UUID.randomUUID();
        UUID geometryCandidateId = UUID.randomUUID();

        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setUjCode("UJ000001");
        project.setAddressId(projectAddressId);

        AddressEntity parentAddress = new AddressEntity();
        parentAddress.setId(projectAddressId);
        parentAddress.setDistrict("1703");
        parentAddress.setCity("Tashkent");

        ProjectGeometryCandidateEntity candidate = new ProjectGeometryCandidateEntity();
        candidate.setId(geometryCandidateId);
        candidate.setProjectId(projectId);
        candidate.setGeometry(JsonNodeFactory.instance.objectNode().put("type", "Polygon"));
        candidate.setAreaM2(new BigDecimal("120"));

        Map<String, Object> buildingData = new LinkedHashMap<>();
        buildingData.put("label", "Building A");
        buildingData.put("houseNumber", "10");
        buildingData.put("category", "residential");
        buildingData.put("hasNonResPart", false);
        buildingData.put("geometryCandidateId", geometryCandidateId.toString());
        buildingData.put("basementsCount", 0);

        when(projectJpaRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(addressJpaRepository.findById(projectAddressId)).thenReturn(Optional.of(parentAddress));
        when(projectGeometryCandidateJpaRepository.findByIdAndProjectId(geometryCandidateId, projectId)).thenReturn(Optional.of(candidate));
        when(projectGeometryCandidateJpaRepository.findByProjectIdAndAssignedBuildingIdAndIdNot(eq(projectId), any(UUID.class), eq(geometryCandidateId))).thenReturn(List.of());
        when(projectJpaRepository.hasLandPlotGeom(projectId)).thenReturn(true);
        when(projectJpaRepository.isGeometryCoveredByLandPlot(projectId, candidate.getGeometry().toString())).thenReturn(true);
        when(buildingJpaRepository.intersectsExistingBuildingGeometry(eq(projectId), any(UUID.class), eq(candidate.getGeometry().toString()))).thenReturn(false);
        when(buildingJpaRepository.updateGeometryAssignment(any(UUID.class), eq(projectId), eq(candidate.getGeometry().toString()), eq(candidate.getAreaM2()), eq(geometryCandidateId), any())).thenReturn(1);
        when(buildingJpaRepository.findByProjectIdOrderByCreatedAtAsc(projectId)).thenReturn(List.of());
        when(buildingJpaRepository.save(any(BuildingEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(buildingJpaRepository.findById(any(UUID.class))).thenAnswer(invocation -> Optional.of(invocation.getArgument(0) == null ? null : new BuildingEntity()));
        when(buildingBlockJpaRepository.findByBuildingId(any())).thenReturn(List.of());
        when(addressJpaRepository.save(any(AddressEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(projectGeometryCandidateJpaRepository.save(any(ProjectGeometryCandidateEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.createBuilding(projectId, buildingData, List.of());

        ArgumentCaptor<AddressEntity> addressCaptor = ArgumentCaptor.forClass(AddressEntity.class);
        verify(addressJpaRepository).save(addressCaptor.capture());
        assertThat(addressCaptor.getValue().getDistrict()).isEqualTo("1703");
        assertThat(addressCaptor.getValue().getBuildingNo()).isEqualTo("10");
        assertThat(addressCaptor.getValue().getFullAddress()).isEqualTo("Tashkent, д. 10");
    }

    private static BuildingBlockEntity blockEntity(UUID id) {
        BuildingBlockEntity block = new BuildingBlockEntity();
        block.setId(id);
        return block;
    }

    @SuppressWarnings({"unchecked", "rawtypes"})
    private static ArgumentCaptor<List<BuildingBlockEntity>> blockListCaptor() {
        return ArgumentCaptor.forClass(List.class);
    }
}
