package uz.reestrmkd.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.common.api.ItemsResponseDto;
import uz.reestrmkd.backend.domain.common.api.OkResponseDto;
import uz.reestrmkd.backend.domain.project.api.ProjectCadastreDataDto;
import uz.reestrmkd.backend.domain.project.api.ProjectExtendedController;
import uz.reestrmkd.backend.domain.project.api.ProjectPassportInfoDto;
import uz.reestrmkd.backend.domain.project.api.ProjectPassportUpdateRequestDto;
import uz.reestrmkd.backend.domain.project.model.AddressEntity;
import uz.reestrmkd.backend.domain.project.model.DistrictEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectDocumentEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectParticipantEntity;
import uz.reestrmkd.backend.domain.project.model.RegionEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectStatus;
import uz.reestrmkd.backend.domain.project.repository.AddressJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.DistrictJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectDocumentJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectParticipantJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.RegionJpaRepository;
import uz.reestrmkd.backend.domain.project.service.ProjectBuildingDetailsService;
import uz.reestrmkd.backend.domain.project.service.ProjectContextService;
import uz.reestrmkd.backend.domain.project.service.ProjectFullRegistryService;
import uz.reestrmkd.backend.domain.project.service.ProjectGeometryService;
import uz.reestrmkd.backend.domain.project.service.ProjectRegistryDetailsService;
import uz.reestrmkd.backend.domain.project.service.ProjectService;
import uz.reestrmkd.backend.domain.registry.service.VersionService;
import uz.reestrmkd.backend.domain.registry.api.GeometryCandidateResponseDto;
import uz.reestrmkd.backend.domain.workflow.service.ApplicationRepositoryService;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectExtendedControllerTests {

    @Mock
    private ProjectContextService projectContextService;
    @Mock
    private VersionService versionService;
    @Mock
    private AddressJpaRepository addressJpaRepository;
    @Mock
    private DistrictJpaRepository districtJpaRepository;
    @Mock
    private ProjectParticipantJpaRepository projectParticipantJpaRepository;
    @Mock
    private ProjectDocumentJpaRepository projectDocumentJpaRepository;
    @Mock
    private ProjectJpaRepository projectJpaRepository;
    @Mock
    private RegionJpaRepository regionJpaRepository;
    @Mock
    private ProjectFullRegistryService projectFullRegistryService;
    @Mock
    private ProjectGeometryService projectGeometryService;
    @Mock
    private ProjectRegistryDetailsService projectRegistryDetailsService;
    @Mock
    private ProjectService projectService;
    @Mock
    private ApplicationRepositoryService applicationRepositoryService;
    @Mock
    private ProjectBuildingDetailsService projectBuildingDetailsService;

    private ProjectExtendedController controller;

    @BeforeEach
    void setUp() {
        controller = new ProjectExtendedController(
            projectContextService,
            versionService,
            addressJpaRepository,
            districtJpaRepository,
            projectParticipantJpaRepository,
            projectDocumentJpaRepository,
            projectJpaRepository,
            regionJpaRepository,
            projectFullRegistryService,
            projectGeometryService,
            projectRegistryDetailsService,
            projectBuildingDetailsService,
            new SecurityPolicyService(),
            projectService,
            applicationRepositoryService
        );
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldReadPassportAddressFromJpaRepositories() {
        UUID projectId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();

        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setName("Project A");
        project.setUjCode("UJ000001");
        project.setRegion("Tashkent");
        project.setDistrict("Yunusabad");
        project.setAddress("Street A");
        project.setAddressId(addressId);
        project.setConstructionStatus("PROJECT");
        project.setCadastreNumber("12:34:56");
        project.setLandPlotAreaM2(new BigDecimal("321.5"));

        AddressEntity address = new AddressEntity();
        address.setId(addressId);
        address.setDistrict("1726269");
        address.setStreet(UUID.randomUUID());
        address.setMahalla(UUID.randomUUID());
        address.setBuildingNo("15");

        DistrictEntity district = new DistrictEntity();
        UUID regionId = UUID.randomUUID();
        district.setId(UUID.randomUUID());
        district.setSoato("1726269");
        district.setRegionId(regionId);

        RegionEntity region = new RegionEntity();
        region.setId(regionId);
        region.setSoato("1703000");

        when(projectJpaRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(addressJpaRepository.findById(addressId)).thenReturn(Optional.of(address));
        when(districtJpaRepository.findBySoato("1726269")).thenReturn(Optional.of(district));
        when(regionJpaRepository.findById(regionId)).thenReturn(Optional.of(region));
        when(projectParticipantJpaRepository.findByProjectId(projectId)).thenReturn(List.of());
        when(projectDocumentJpaRepository.findByProjectIdOrderByDocDateDescIdDesc(projectId)).thenReturn(List.of());

        Map<String, Object> response = controller.passport(projectId).data();

        Map<String, Object> complexInfo = complexInfo(response);
        assertThat(complexInfo).containsEntry("addressId", addressId);
        assertThat(complexInfo).containsEntry("districtSoato", "1726269");
        assertThat(complexInfo).containsEntry("buildingNo", "15");
        assertThat(complexInfo).containsEntry("regionSoato", "1703000");
    }

    @Test
    void shouldUpdatePassportAndAddressViaJpa() {
        UUID projectId = UUID.randomUUID();
        UUID addressId = UUID.randomUUID();

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        ProjectEntity project = new ProjectEntity();
        project.setId(projectId);
        project.setScopeId("scope-1");
        project.setName("Old Name");
        project.setAddressId(addressId);

        AddressEntity address = new AddressEntity();
        address.setId(addressId);

        ProjectPassportInfoDto info = new ProjectPassportInfoDto(
            "New Name",
            "Tashkent",
            "Yunusabad",
            "Street A",
            "17",
            "1726269",
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            "Mahalla-1",
            "15",
            "Landmark",
            ProjectStatus.PROJECT,
            null,
            null,
            null,
            null
        );
        ProjectPassportUpdateRequestDto payload = new ProjectPassportUpdateRequestDto(
            info,
            new ProjectCadastreDataDto("12:34:56:78", new BigDecimal("400"))
        );

        when(projectJpaRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(projectJpaRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(addressJpaRepository.findById(addressId)).thenReturn(Optional.of(address));
        when(addressJpaRepository.save(any(AddressEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> response = controller.updatePassport(projectId, payload).data();

        ArgumentCaptor<AddressEntity> addressCaptor = ArgumentCaptor.forClass(AddressEntity.class);
        verify(addressJpaRepository).save(addressCaptor.capture());
        assertThat(addressCaptor.getValue().getBuildingNo()).isEqualTo("15");
        assertThat(addressCaptor.getValue().getCity()).isEqualTo("Tashkent");

        ArgumentCaptor<ProjectEntity> projectCaptor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projectJpaRepository).save(projectCaptor.capture());
        assertThat(projectCaptor.getValue().getName()).isEqualTo("New Name");
        assertThat(projectCaptor.getValue().getAddressId()).isEqualTo(addressId);
        assertThat(projectCaptor.getValue().getLandPlotAreaM2()).isEqualByComparingTo("400");

        assertThat(response).containsEntry("name", "New Name");
        assertThat(response).containsEntry("address_id", addressId);
    }

    @Test
    void shouldDelegateBuildingDetailsSaveToService() {
        UUID projectId = UUID.randomUUID();

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        when(projectBuildingDetailsService.saveBuildingDetails(eq(projectId), eq(null)))
            .thenReturn(Map.of("ok", true, "projectId", projectId));

        Map<String, Object> response = controller.saveBd(projectId, null).data();

        verify(projectBuildingDetailsService).saveBuildingDetails(projectId, null);
        assertThat(response).containsEntry("ok", true);
        assertThat(response).containsEntry("projectId", projectId);
    }

    @Test
    void shouldUpsertParticipantViaJpa() {
        UUID projectId = UUID.randomUUID();
        UUID participantId = UUID.randomUUID();

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        when(projectParticipantJpaRepository.findById(participantId)).thenReturn(Optional.empty());
        when(projectParticipantJpaRepository.save(any(ProjectParticipantEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> response = controller.upsertParticipant(
            projectId,
            "developer",
            new uz.reestrmkd.backend.domain.common.api.MapPayloadDto(Map.of(
                "id", participantId.toString(),
                "name", "Dev LLC",
                "inn", "123456789"
            ))
        ).data();

        assertThat(response).containsEntry("id", participantId);
        assertThat(response).containsEntry("role", "developer");
        assertThat(response).containsEntry("name", "Dev LLC");
    }

    @Test
    void shouldUpsertAndDeleteDocumentViaJpa() {
        UUID projectId = UUID.randomUUID();
        UUID documentId = UUID.randomUUID();

        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        when(projectDocumentJpaRepository.findById(documentId)).thenReturn(Optional.empty());
        when(projectDocumentJpaRepository.save(any(ProjectDocumentEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> response = controller.upsertDoc(
            projectId,
            new uz.reestrmkd.backend.domain.common.api.MapPayloadDto(Map.of(
                "doc", Map.of(
                    "id", documentId.toString(),
                    "name", "Permit",
                    "type", "permit",
                    "date", "2026-03-07",
                    "number", "77",
                    "url", "http://localhost/file.pdf"
                )
            ))
        ).data();

        assertThat(response).containsEntry("id", documentId);
        assertThat(response).containsEntry("doc_type", "permit");

        Map<String, Object> deleteResponse = controller.delDoc(documentId).data();
        verify(projectDocumentJpaRepository).deleteById(documentId);
        assertThat(deleteResponse).containsEntry("ok", true);
    }

    @Test
    void shouldDelegateFullRegistryToService() {
        UUID projectId = UUID.randomUUID();
        Map<String, Object> expected = Map.of(
            "buildings", List.of(Map.of("id", UUID.randomUUID())),
            "blocks", List.of(),
            "floors", List.of(),
            "entrances", List.of(),
            "units", List.of()
        );
        when(projectFullRegistryService.getFullRegistry(projectId)).thenReturn(expected);

        Map<String, Object> response = controller.fullRegistry(projectId);

        assertThat(response).isEqualTo(expected);
    }

    @Test
    void shouldDelegateRegistryDetailsToService() {
        UUID projectId = UUID.randomUUID();
        Map<String, Object> expected = Map.of(
            "markerRows", List.of(Map.of("block_id", UUID.randomUUID(), "marker_key", "P1")),
            "floors", List.of(),
            "entrances", List.of(),
            "matrix", List.of(),
            "units", List.of(),
            "mops", List.of()
        );
        when(projectRegistryDetailsService.getRegistryDetails(projectId)).thenReturn(expected);

        Map<String, Object> response = controller.registryDetails(projectId).data();

        assertThat(response).isEqualTo(expected);
    }

    @Test
    void shouldDelegateCandidatesToGeometryService() {
        UUID projectId = UUID.randomUUID();
        List<GeometryCandidateResponseDto> expected = List.of();
        when(projectGeometryService.getCandidates(projectId)).thenReturn(expected);

        ItemsResponseDto response = controller.candidates(projectId);

        assertThat(response.items()).isEqualTo(expected);
    }

    @Test
    void shouldDelegateCandidateImportToGeometryService() {
        UUID projectId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );
        var geometry = new ObjectMapper().valueToTree(Map.of("type", "Polygon"));
        var item = new uz.reestrmkd.backend.domain.registry.api.GeometryCandidateImportItemDto(1, "Lot 1", null, geometry);
        var request = new uz.reestrmkd.backend.domain.registry.api.GeometryCandidatesImportRequestDto(List.of(item));
        when(projectGeometryService.importCandidates(projectId, List.of(item))).thenReturn(1);

        Map<String, Object> response = controller.importCandidates(projectId, request).data();

        verify(projectGeometryService).importCandidates(projectId, List.of(item));
        assertThat(response).containsEntry("ok", true);
        assertThat(response).containsEntry("imported", 1);
    }

    @Test
    void shouldDelegateLandPlotSelectionToGeometryService() {
        UUID projectId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        OkResponseDto response = controller.selectLand(projectId, Map.of("candidateId", candidateId.toString()));

        verify(projectGeometryService).selectLand(projectId, candidateId);
        assertThat(response.ok()).isTrue();
    }

    @Test
    void shouldDelegateLandPlotUnselectToGeometryService() {
        UUID projectId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        OkResponseDto response = controller.unselectLand(projectId);

        verify(projectGeometryService).unselectLand(projectId);
        assertThat(response.ok()).isTrue();
    }

    @Test
    void shouldDelegateCandidateDeletionToGeometryService() {
        UUID projectId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        OkResponseDto response = controller.delCandidate(projectId, candidateId);

        verify(projectGeometryService).deleteCandidate(projectId, candidateId);
        assertThat(response.ok()).isTrue();
    }

    @Test
    void shouldDelegateBuildingGeometrySelectionToGeometryService() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID candidateId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        OkResponseDto response = controller.selectBuildingGeometry(projectId, buildingId, Map.of("candidateId", candidateId.toString()));

        verify(projectGeometryService).selectBuildingGeometry(projectId, buildingId, candidateId);
        assertThat(response.ok()).isTrue();
    }

    @Test
    void shouldDelegateBuildingGeometryClearingToGeometryService() {
        UUID projectId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );

        OkResponseDto response = controller.selectBuildingGeometry(projectId, buildingId, Map.of());

        verify(projectGeometryService).selectBuildingGeometry(projectId, buildingId, null);
        assertThat(response.ok()).isTrue();
    }

    @Test
    void shouldDelegateVersionsListingToVersionService() {
        UUID entityId = UUID.randomUUID();
        List<Map<String, Object>> expected = List.of(Map.of(
            "id", 1L,
            "entity_type", "project",
            "entity_id", entityId,
            "version_number", 2,
            "version_status", "PENDING"
        ));
        when(versionService.getVersions("project", entityId)).thenReturn(expected);

        ItemsResponseDto response = controller.versions("project", entityId);

        verify(versionService).getVersions("project", entityId);
        assertThat(response.items()).isEqualTo(expected);
    }

    @Test
    void shouldDelegateVersionSnapshotToVersionService() {
        Map<String, Object> expected = Map.of("snapshot_data", Map.of("name", "Project A"));
        when(versionService.getSnapshot(42L)).thenReturn(expected);

        Map<String, Object> response = controller.snapshot(42L).data();

        verify(versionService).getSnapshot(42L);
        assertThat(response).isEqualTo(expected);
    }

    @Test
    void shouldDelegateVersionStatusUpdatesToVersionService() {
        OkResponseDto approveResponse = controller.approveVersion(11L);
        OkResponseDto declineResponse = controller.declineVersion(12L);
        OkResponseDto restoreResponse = controller.restore(13L);

        verify(versionService).approveVersion(11L);
        verify(versionService).declineVersion(12L);
        verify(versionService).restoreVersion(13L);
        assertThat(approveResponse.ok()).isTrue();
        assertThat(declineResponse.ok()).isTrue();
        assertThat(restoreResponse.ok()).isTrue();
    }

    @Test
    void shouldDeleteProjectViaJpaRepository() {
        UUID projectId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "admin", "bff"), null)
        );

        OkResponseDto response = controller.delProject(projectId);

        verify(projectJpaRepository).deleteById(projectId);
        assertThat(response.ok()).isTrue();
    }

    @Test
    void shouldDelegateStepStatusesSavingToApplicationRepositoryService() {
        UUID projectId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );
        Map<String, Object> statuses = Map.of("block-1", "done");
        when(applicationRepositoryService.saveStepBlockStatuses(projectId, "scope-1", 3, statuses)).thenReturn(applicationId);

        Map<String, Object> response = controller.saveStep(
            projectId,
            new uz.reestrmkd.backend.domain.common.api.MapPayloadDto(Map.of(
                "scope", "scope-1",
                "stepIndex", 3,
                "statuses", statuses
            ))
        ).data();

        verify(applicationRepositoryService).saveStepBlockStatuses(projectId, "scope-1", 3, statuses);
        assertThat(response).containsEntry("applicationId", applicationId);
        assertThat(response).containsEntry("stepIndex", 3);
        assertThat(response).containsEntry("blockStatuses", statuses);
    }

    @Test
    void shouldPersistMetaHistoryAndCompletedStepsViaServices() {
        UUID projectId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", "technician", "bff"), null)
        );
        Instant now = Instant.now();

        when(projectService.mergeApplicationInfo(projectId, "scope-1", Map.of(
            "status", "IN_PROGRESS",
            "completedSteps", List.of(1, 2),
            "history", List.of(Map.of(
                "date", now.toString(),
                "action", "SAVE",
                "prevStatus", "DRAFT",
                "user", "tester",
                "comment", "ok"
            ))
        ))).thenReturn(applicationId);

        Map<String, Object> response = controller.saveMeta(
            projectId,
            new uz.reestrmkd.backend.domain.common.api.MapPayloadDto(Map.of(
                "scope", "scope-1",
                "applicationInfo", Map.of(
                    "status", "IN_PROGRESS",
                    "completedSteps", List.of(1, 2),
                    "history", List.of(Map.of(
                        "date", now.toString(),
                        "action", "SAVE",
                        "prevStatus", "DRAFT",
                        "user", "tester",
                        "comment", "ok"
                    ))
                )
            ))
        ).data();

        verify(applicationRepositoryService).addHistory(applicationId, "SAVE", "DRAFT", "IN_PROGRESS", "tester", "ok", now);
        verify(applicationRepositoryService).updateStepCompletion(applicationId, 1, true);
        verify(applicationRepositoryService).updateStepCompletion(applicationId, 2, true);
        assertThat(response).containsEntry("applicationId", applicationId);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> complexInfo(Map<String, Object> response) {
        return (Map<String, Object>) response.get("complexInfo");
    }
}
