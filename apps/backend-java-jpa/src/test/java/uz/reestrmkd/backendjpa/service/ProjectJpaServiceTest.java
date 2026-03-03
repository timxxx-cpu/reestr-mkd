package uz.reestrmkd.backendjpa.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import uz.reestrmkd.backendjpa.domain.ApplicationEntity;
import uz.reestrmkd.backendjpa.domain.ProjectEntity;
import uz.reestrmkd.backendjpa.domain.ProjectGeometryCandidateEntity;
import uz.reestrmkd.backendjpa.repo.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectJpaServiceTest {

    @Mock private ProjectRepository projects;
    @Mock private ApplicationRepository applications;
    @Mock private ApplicationStepRepository applicationSteps;
    @Mock private ApplicationHistoryRepository applicationHistory;
    @Mock private ObjectMapper objectMapper;
    @Mock private org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate jdbc;
    @Mock private BuildingRepository buildingsRepo;
    @Mock private BuildingBlockRepository blocksRepo;
    @Mock private BlockConstructionRepository blockConstructionRepo;
    @Mock private BlockEngineeringRepository blockEngineeringRepo;
    @Mock private BlockFloorMarkerRepository markersRepo;
    @Mock private FloorRepository floorRepo;
    @Mock private UnitRepository unitRepo;
    @Mock private ProjectParticipantRepository participantsRepo;
    @Mock private ProjectDocumentRepository documentsRepo;
    @Mock private EntranceRepository entranceRepo;
    @Mock private EntranceMatrixRepository entranceMatrixRepo;
    @Mock private CommonAreaRepository commonAreaRepo;
    @Mock private BlockExtensionRepository blockExtensionRepo;
    @Mock private RoomRepository roomRepo;
    @Mock private ProjectGeometryCandidateRepository geometryCandidateRepo;

    @InjectMocks
    private ProjectJpaService service;

    @Test
    void list_requires_scope() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.list("  ", null, null, null, null, null, null, null, null));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Scope is required", ex.getReason());
    }

    @Test
    void list_returns_items_and_total() {
        ProjectEntity p1 = new ProjectEntity();
        p1.setId("p1");
        ProjectEntity p2 = new ProjectEntity();
        p2.setId("p2");
        when(projects.findByScopeIdOrderByIdDesc("shared_dev_env")).thenReturn(List.of(p1, p2));

        Map<String, Object> res = service.list("shared_dev_env", null, null, null, null, null, null, null, null);

        assertEquals(2, ((List<?>) res.get("items")).size());
        assertEquals(2, res.get("total"));
        assertEquals(1, res.get("page"));
        assertEquals(100, res.get("limit"));
    }

    @Test
    void list_supports_status_and_assignee_filters_and_pagination() {
        ProjectEntity p1 = new ProjectEntity();
        p1.setId("p1");
        p1.setScopeId("shared_dev_env");
        p1.setName("Alpha");
        p1.setConstructionStatus("in_progress");

        ProjectEntity p2 = new ProjectEntity();
        p2.setId("p2");
        p2.setScopeId("shared_dev_env");
        p2.setName("Beta");
        p2.setConstructionStatus("completed");

        ApplicationEntity a1 = new ApplicationEntity();
        a1.setId("a1");
        a1.setProjectId("p1");
        a1.setScopeId("shared_dev_env");
        a1.setStatus("IN_PROGRESS");
        a1.setWorkflowSubstatus("DRAFT");
        a1.setAssigneeName("user-1");

        ApplicationEntity a2 = new ApplicationEntity();
        a2.setId("a2");
        a2.setProjectId("p2");
        a2.setScopeId("shared_dev_env");
        a2.setStatus("COMPLETED");
        a2.setWorkflowSubstatus("DONE");
        a2.setAssigneeName("user-2");

        when(applications.findByScopeId("shared_dev_env")).thenReturn(List.of(a1, a2));
        when(projects.findByScopeIdOrderByIdDesc("shared_dev_env")).thenReturn(List.of(p1, p2));
        when(buildingsRepo.findByProjectIdIn(org.mockito.ArgumentMatchers.anyList())).thenReturn(List.of());

        Map<String, Object> res = service.list("shared_dev_env", "IN_PROGRESS", "DRAFT", "mine", null, 1, 1, "user-1", "admin");

        assertEquals(1, ((List<?>) res.get("items")).size());
        assertEquals(1, res.get("total"));
        assertEquals(1, res.get("page"));
        assertEquals(1, res.get("limit"));
        assertEquals(1, res.get("totalPages"));
    }

    @Test
    void list_assignee_mine_requires_actor() {
        ApplicationEntity a1 = new ApplicationEntity();
        a1.setProjectId("p1");
        a1.setScopeId("shared_dev_env");
        when(applications.findByScopeId("shared_dev_env")).thenReturn(List.of(a1));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.list("shared_dev_env", null, null, "mine", null, null, null, null, null));

        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
        assertEquals("Auth context required for assignee=mine", ex.getReason());
    }

    @Test
    void appId_requires_scope() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.appId("project-1", ""));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("scope is required", ex.getReason());
    }

    @Test
    void appId_returns_404_when_missing() {
        when(applications.findFirstByProjectIdAndScopeId("project-1", "shared_dev_env")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.appId("project-1", "shared_dev_env"));
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertEquals("Application not found", ex.getReason());
    }

    @Test
    void appId_returns_application_id() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-1");
        when(applications.findFirstByProjectIdAndScopeId("project-1", "shared_dev_env")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.appId("project-1", "shared_dev_env");

        assertEquals("app-1", res.get("applicationId"));
    }

    @Test
    void mapOverview_uses_repository_graph_and_returns_items() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p1");
        project.setUjCode("UJ-1");
        project.setName("Project 1");
        project.setAddress("Addr");
        project.setConstructionStatus("PLANNED");

        ApplicationEntity app = new ApplicationEntity();
        app.setProjectId("p1");
        app.setStatus("IN_PROGRESS");

        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b1");
        building.setProjectId("p1");
        building.setCategory("residential");
        building.setLabel("B-1");

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity block = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        block.setId("bl1");
        block.setBuildingId("b1");
        block.setLabel("BL-1");
        block.setFloorsCount(9);
        block.setIsBasementBlock(false);

        uz.reestrmkd.backendjpa.domain.FloorEntity floor = new uz.reestrmkd.backendjpa.domain.FloorEntity();
        floor.setId("f1");
        floor.setBlockId("bl1");

        uz.reestrmkd.backendjpa.domain.UnitEntity unit = new uz.reestrmkd.backendjpa.domain.UnitEntity();
        unit.setId("u1");
        unit.setFloorId("f1");
        unit.setUnitType("apartment");

        when(projects.findByScopeIdOrderByIdDesc("shared_dev_env")).thenReturn(List.of(project));
        when(applications.findByScopeId("shared_dev_env")).thenReturn(List.of(app));
        when(buildingsRepo.findByProjectIdIn(List.of("p1"))).thenReturn(List.of(building));
        when(blocksRepo.findByBuildingIdIn(List.of("b1"))).thenReturn(List.of(block));
        when(floorRepo.findByBlockIdIn(List.of("bl1"))).thenReturn(List.of(floor));
        when(unitRepo.findByFloorIdIn(List.of("f1"))).thenReturn(List.of(unit));

        Map<String, Object> res = service.mapOverview("shared_dev_env");

        List<?> items = (List<?>) res.get("items");
        assertEquals(1, items.size());
        Map<?, ?> item = (Map<?, ?>) items.get(0);
        assertEquals("IN_PROGRESS", item.get("status"));
        assertEquals(1, item.get("totalBuildings"));
    }


    @Test
    void summary_requires_scope() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.summary(" "));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("scope is required", ex.getReason());
    }

    @Test
    void summary_counts_statuses_from_repository_data() {
        ApplicationEntity a1 = new ApplicationEntity();
        a1.setStatus("IN_PROGRESS");
        a1.setWorkflowSubstatus("DRAFT");

        ApplicationEntity a2 = new ApplicationEntity();
        a2.setStatus("IN_PROGRESS");
        a2.setWorkflowSubstatus("REVIEW");

        ApplicationEntity a3 = new ApplicationEntity();
        a3.setStatus("DECLINED");
        a3.setWorkflowSubstatus("DECLINED_BY_ADMIN");

        ApplicationEntity a4 = new ApplicationEntity();
        a4.setStatus("COMPLETED");
        a4.setWorkflowSubstatus("INTEGRATION");

        when(applications.findByScopeId("shared_dev_env")).thenReturn(List.of(a1, a2, a3, a4));

        Map<String, Object> res = service.summary("shared_dev_env");

        assertEquals(1, res.get("work"));
        assertEquals(1, res.get("review"));
        assertEquals(1, res.get("integration"));
        assertEquals(0, res.get("pendingDecline"));
        assertEquals(1, res.get("declined"));
        assertEquals(2, res.get("registryApplications"));
        assertEquals(1, res.get("registryComplexes"));
    }


    @Test
    void mapOverview_requires_scope() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.mapOverview(" "));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("Scope is required", ex.getReason());
    }

    @Test
    void mapOverview_excludes_basement_blocks_from_stats() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p2");
        project.setUjCode("UJ-2");
        project.setName("Project 2");
        project.setConstructionStatus("PLANNED");

        when(projects.findByScopeIdOrderByIdDesc("shared_dev_env")).thenReturn(List.of(project));
        when(applications.findByScopeId("shared_dev_env")).thenReturn(List.of());

        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b2");
        building.setProjectId("p2");
        building.setCategory("residential");
        when(buildingsRepo.findByProjectIdIn(List.of("p2"))).thenReturn(List.of(building));

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity regular = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        regular.setId("rb");
        regular.setBuildingId("b2");
        regular.setLabel("R");
        regular.setFloorsCount(7);
        regular.setIsBasementBlock(false);

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity basement = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        basement.setId("bb");
        basement.setBuildingId("b2");
        basement.setLabel("B");
        basement.setFloorsCount(2);
        basement.setIsBasementBlock(true);

        when(blocksRepo.findByBuildingIdIn(List.of("b2"))).thenReturn(List.of(regular, basement));

        uz.reestrmkd.backendjpa.domain.FloorEntity floor = new uz.reestrmkd.backendjpa.domain.FloorEntity();
        floor.setId("f2");
        floor.setBlockId("rb");
        when(floorRepo.findByBlockIdIn(List.of("rb", "bb"))).thenReturn(List.of(floor));

        uz.reestrmkd.backendjpa.domain.UnitEntity apt = new uz.reestrmkd.backendjpa.domain.UnitEntity();
        apt.setId("u2");
        apt.setFloorId("f2");
        apt.setUnitType("apartment");
        when(unitRepo.findByFloorIdIn(List.of("f2"))).thenReturn(List.of(apt));

        Map<String, Object> res = service.mapOverview("shared_dev_env");

        List<?> items = (List<?>) res.get("items");
        Map<?, ?> item = (Map<?, ?>) items.get(0);
        List<?> buildings = (List<?>) item.get("buildings");
        Map<?, ?> b0 = (Map<?, ?>) buildings.get(0);

        assertEquals(1, b0.get("blocksCount"));
        assertEquals(7, b0.get("floorsMax"));
        assertEquals(1, b0.get("apartmentsCount"));
    }


    @Test
    void mapOverview_returns_empty_items_for_empty_scope_data() {
        when(projects.findByScopeIdOrderByIdDesc("shared_dev_env")).thenReturn(List.of());
        when(applications.findByScopeId("shared_dev_env")).thenReturn(List.of());

        Map<String, Object> res = service.mapOverview("shared_dev_env");

        assertEquals(List.of(), res.get("items"));
    }

    @Test
    void mapOverview_falls_back_to_project_construction_status_when_app_missing() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p3");
        project.setConstructionStatus("PROJECT_STATUS");
        project.setName("P3");

        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b3");
        building.setProjectId("p3");
        building.setCategory("residential");

        when(projects.findByScopeIdOrderByIdDesc("shared_dev_env")).thenReturn(List.of(project));
        when(applications.findByScopeId("shared_dev_env")).thenReturn(List.of());
        when(buildingsRepo.findByProjectIdIn(List.of("p3"))).thenReturn(List.of(building));
        when(blocksRepo.findByBuildingIdIn(List.of("b3"))).thenReturn(List.of());

        Map<String, Object> res = service.mapOverview("shared_dev_env");

        List<?> items = (List<?>) res.get("items");
        Map<?, ?> item = (Map<?, ?>) items.get(0);
        assertEquals("PROJECT_STATUS", item.get("status"));
    }


    @Test
    void summary_counts_pending_decline() {
        ApplicationEntity a = new ApplicationEntity();
        a.setStatus("IN_PROGRESS");
        a.setWorkflowSubstatus("PENDING_DECLINE");

        when(applications.findByScopeId("shared_dev_env")).thenReturn(List.of(a));

        Map<String, Object> res = service.summary("shared_dev_env");

        assertEquals(1, res.get("pendingDecline"));
        assertEquals(0, res.get("work"));
        assertEquals(0, res.get("review"));
        assertEquals(0, res.get("integration"));
    }










    @Test
    void updatePassport_updates_project_via_repository_save() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p-up");
        project.setName("Old");

        when(projects.findById("p-up")).thenReturn(Optional.of(project));
        when(projects.save(project)).thenReturn(project);

        Map<String, Object> res = service.updatePassport("p-up", Map.of(
            "info", Map.of(
                "name", "New Name",
                "status", "IN_PROGRESS",
                "street", "Main st"
            ),
            "cadastreData", Map.of("number", "10:10", "area", "123.5")
        ));

        assertEquals("New Name", project.getName());
        assertEquals("IN_PROGRESS", project.getConstructionStatus());
        assertEquals("Main st", project.getAddress());
        assertEquals("10:10", project.getCadastreNumber());
        assertEquals("p-up", res.get("id"));
        verify(projects).save(project);
    }

    @Test
    void updatePassport_returns_404_when_project_missing() {
        when(projects.findById("p-miss-up")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.updatePassport("p-miss-up", Map.of("info", Map.of(), "cadastreData", Map.of())));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    void passport_returns_404_when_project_missing() {
        when(projects.findById("p-missing")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.passport("p-missing"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    void passport_uses_project_and_repository_lists() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p-pass");
        project.setName("Complex");
        project.setUjCode("UJ-P");
        project.setAddressId(null);
        when(projects.findById("p-pass")).thenReturn(Optional.of(project));

        uz.reestrmkd.backendjpa.domain.ProjectParticipantEntity participant = new uz.reestrmkd.backendjpa.domain.ProjectParticipantEntity();
        participant.setId("part");
        participant.setRole("developer");
        participant.setName("Dev LLC");
        when(participantsRepo.findByProjectId("p-pass")).thenReturn(List.of(participant));

        uz.reestrmkd.backendjpa.domain.ProjectDocumentEntity doc = new uz.reestrmkd.backendjpa.domain.ProjectDocumentEntity();
        doc.setId("doc");
        doc.setName("Permit");
        doc.setDocType("license");
        when(documentsRepo.findByProjectIdOrderByDocDateDesc("p-pass")).thenReturn(List.of(doc));

        Map<String, Object> res = service.passport("p-pass");

        Map<?, ?> complexInfo = (Map<?, ?>) res.get("complexInfo");
        assertEquals("Complex", complexInfo.get("name"));
        Map<?, ?> participants = (Map<?, ?>) res.get("participants");
        assertEquals(1, participants.size());
        List<?> documents = (List<?>) res.get("documents");
        assertEquals(1, documents.size());
    }

    @Test
    void updateBasementLevel_updates_levels_via_repository() {
        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity basement = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        basement.setId("bb-upd");
        basement.setIsBasementBlock(true);
        basement.setBasementDepth(2);
        basement.setBasementParkingLevels(new java.util.LinkedHashMap<>(Map.of("1", false)));

        when(blocksRepo.findById("bb-upd")).thenReturn(Optional.of(basement));

        Map<String, Object> res = service.updateBasementLevel("bb-upd", 1, Map.of("isEnabled", true));

        assertEquals(true, res.get("ok"));
        assertEquals(true, basement.getBasementParkingLevels().get("1"));
        verify(blocksRepo).save(basement);
    }

    @Test
    void updateBasementLevel_returns_404_when_not_found() {
        when(blocksRepo.findById("missing")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.updateBasementLevel("missing", 1, Map.of("isEnabled", true)));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }

    @Test
    void tepSummary_reads_from_repositories() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-tep");
        building.setDateStart(java.time.LocalDate.of(2020, 1, 1));
        building.setDateEnd(java.time.LocalDate.of(2030, 1, 1));
        when(buildingsRepo.findByProjectId("p-tep")).thenReturn(List.of(building));

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity block = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        block.setId("bl-tep");
        when(blocksRepo.findByBuildingIdIn(List.of("b-tep"))).thenReturn(List.of(block));

        uz.reestrmkd.backendjpa.domain.FloorEntity floor = new uz.reestrmkd.backendjpa.domain.FloorEntity();
        floor.setId("f-tep");
        floor.setAreaProj(new java.math.BigDecimal("100"));
        floor.setAreaFact(new java.math.BigDecimal("90"));
        when(floorRepo.findByBlockIdIn(List.of("bl-tep"))).thenReturn(List.of(floor));

        uz.reestrmkd.backendjpa.domain.UnitEntity unit = new uz.reestrmkd.backendjpa.domain.UnitEntity();
        unit.setFloorId("f-tep");
        unit.setUnitType("flat");
        unit.setTotalArea(new java.math.BigDecimal("40"));
        unit.setCadastreNumber("cad-1");
        when(unitRepo.findByFloorIdIn(List.of("f-tep"))).thenReturn(List.of(unit));

        Map<String, Object> res = service.tepSummary("p-tep");

        assertEquals(100d, (Double) res.get("totalAreaProj"));
        assertEquals(90d, (Double) res.get("totalAreaFact"));
        assertEquals(1, res.get("cadastreReadyCount"));
        assertEquals(1, res.get("totalObjectsCount"));
    }

    @Test
    void parkingCounts_reads_from_repository_graph() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-p");
        when(buildingsRepo.findByProjectId("p-p")).thenReturn(List.of(building));

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity block = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        block.setId("bl-p");
        when(blocksRepo.findByBuildingIdIn(List.of("b-p"))).thenReturn(List.of(block));

        uz.reestrmkd.backendjpa.domain.FloorEntity floor = new uz.reestrmkd.backendjpa.domain.FloorEntity();
        floor.setId("f-p");
        when(floorRepo.findByBlockIdIn(List.of("bl-p"))).thenReturn(List.of(floor));

        uz.reestrmkd.backendjpa.domain.UnitEntity parking = new uz.reestrmkd.backendjpa.domain.UnitEntity();
        parking.setUnitType("parking");
        uz.reestrmkd.backendjpa.domain.UnitEntity legacyParking = new uz.reestrmkd.backendjpa.domain.UnitEntity();
        legacyParking.setUnitType("parking_place");
        uz.reestrmkd.backendjpa.domain.UnitEntity apartment = new uz.reestrmkd.backendjpa.domain.UnitEntity();
        apartment.setUnitType("apartment");
        when(unitRepo.findByFloorIdIn(List.of("f-p"))).thenReturn(List.of(parking, legacyParking, apartment));

        Map<String, Object> res = service.parkingCounts("p-p");

        assertEquals(2, res.get("parkingPlaces"));
    }

    @Test
    void fullRegistry_reads_core_lists_from_repositories() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p-fr");
        project.setAddressId("addr-p");
        when(projects.findById("p-fr")).thenReturn(Optional.of(project));

        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-fr");
        building.setProjectId("p-fr");
        building.setAddressId("addr-b");
        when(buildingsRepo.findByProjectId("p-fr")).thenReturn(List.of(building));

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity block = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        block.setId("bl-fr");
        block.setBuildingId("b-fr");
        when(blocksRepo.findByBuildingIdIn(List.of("b-fr"))).thenReturn(List.of(block));

        when(blockExtensionRepo.findByParentBlockIdInOrderByCreatedAtAsc(List.of("bl-fr"))).thenReturn(List.of());

        uz.reestrmkd.backendjpa.domain.FloorEntity floor = new uz.reestrmkd.backendjpa.domain.FloorEntity();
        floor.setId("f-fr");
        floor.setBlockId("bl-fr");
        when(floorRepo.findByBlockIdIn(List.of("bl-fr"))).thenReturn(List.of(floor));

        when(entranceRepo.findByBlockIdIn(List.of("bl-fr"))).thenReturn(List.of());

        uz.reestrmkd.backendjpa.domain.UnitEntity unit = new uz.reestrmkd.backendjpa.domain.UnitEntity();
        unit.setId("u-fr");
        unit.setFloorId("f-fr");
        unit.setNumber("1");
        unit.setUnitType("apartment");
        when(unitRepo.findByFloorIdIn(List.of("f-fr"))).thenReturn(List.of(unit));

        when(roomRepo.findByUnitIdIn(List.of("u-fr"))).thenReturn(List.of());

        Map<String, Object> res = service.fullRegistry("p-fr");

        assertEquals(1, ((List<?>) res.get("buildings")).size());
        assertEquals(1, ((List<?>) res.get("blocks")).size());
        assertEquals(1, ((List<?>) res.get("floors")).size());
        assertEquals(1, ((List<?>) res.get("units")).size());
    }

    @Test
    void buildingsSummary_reads_from_repository() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-sum");
        building.setProjectId("p-sum");
        building.setLabel("Building A");
        building.setCategory("residential");

        when(buildingsRepo.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(building));

        List<Map<String, Object>> res = service.buildingsSummary();

        assertEquals(1, res.size());
        assertEquals("b-sum", res.get(0).get("id"));
        assertEquals("Building A", res.get(0).get("label"));
    }

    @Test
    void basements_reads_from_repository_graph() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-base");
        when(buildingsRepo.findByProjectId("p-base")).thenReturn(List.of(building));

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity basement = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        basement.setId("bb-base");
        basement.setBuildingId("b-base");
        basement.setLinkedBlockIds(List.of("bl-1"));
        basement.setBasementDepth(2);
        basement.setBasementHasParking(true);
        basement.setEntrancesCount(3);

        when(blocksRepo.findByBuildingIdInAndIsBasementBlockTrue(List.of("b-base"))).thenReturn(List.of(basement));

        List<Map<String, Object>> res = service.basements("p-base");

        assertEquals(1, res.size());
        assertEquals("bb-base", res.get(0).get("id"));
        assertEquals("bl-1", res.get(0).get("blockId"));
        assertEquals(true, res.get(0).get("hasParking"));
    }

    @Test
    void contextRegistryDetails_uses_repositories() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-rd");
        when(buildingsRepo.findByProjectIdIn(List.of("p-rd"))).thenReturn(List.of(building));

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity block = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        block.setId("bl-rd");
        block.setBuildingId("b-rd");
        when(blocksRepo.findByBuildingIdIn(List.of("b-rd"))).thenReturn(List.of(block));

        uz.reestrmkd.backendjpa.domain.BlockFloorMarkerEntity marker = new uz.reestrmkd.backendjpa.domain.BlockFloorMarkerEntity();
        marker.setBlockId("bl-rd");
        marker.setMarkerKey("1");
        marker.setIsTechnical(true);
        when(markersRepo.findByBlockIdIn(List.of("bl-rd"))).thenReturn(List.of(marker));

        uz.reestrmkd.backendjpa.domain.FloorEntity floor = new uz.reestrmkd.backendjpa.domain.FloorEntity();
        floor.setId("f-rd");
        floor.setBlockId("bl-rd");
        floor.setFloorKey("F1");
        when(floorRepo.findByBlockIdIn(List.of("bl-rd"))).thenReturn(List.of(floor));

        uz.reestrmkd.backendjpa.domain.EntranceEntity entrance = new uz.reestrmkd.backendjpa.domain.EntranceEntity();
        entrance.setId("e-rd");
        entrance.setBlockId("bl-rd");
        entrance.setNumber(1);
        when(entranceRepo.findByBlockIdIn(List.of("bl-rd"))).thenReturn(List.of(entrance));

        uz.reestrmkd.backendjpa.domain.EntranceMatrixEntity matrix = new uz.reestrmkd.backendjpa.domain.EntranceMatrixEntity();
        matrix.setFloorId("f-rd");
        matrix.setEntranceNumber(1);
        matrix.setFlatsCount(3);
        when(entranceMatrixRepo.findByBlockIdIn(List.of("bl-rd"))).thenReturn(List.of(matrix));

        uz.reestrmkd.backendjpa.domain.UnitEntity unit = new uz.reestrmkd.backendjpa.domain.UnitEntity();
        unit.setId("u-rd");
        unit.setFloorId("f-rd");
        unit.setUnitType("apartment");
        when(unitRepo.findByFloorIdIn(List.of("f-rd"))).thenReturn(List.of(unit));

        uz.reestrmkd.backendjpa.domain.CommonAreaEntity mop = new uz.reestrmkd.backendjpa.domain.CommonAreaEntity();
        mop.setId("m-rd");
        mop.setFloorId("f-rd");
        mop.setType("hall");
        when(commonAreaRepo.findByFloorIdIn(List.of("f-rd"))).thenReturn(List.of(mop));

        Map<String, Object> res = service.contextRegistryDetails("p-rd");

        assertEquals(1, ((List<?>) res.get("markerRows")).size());
        assertEquals(1, ((List<?>) res.get("floors")).size());
        assertEquals(1, ((List<?>) res.get("entrances")).size());
        assertEquals(1, ((List<?>) res.get("matrix")).size());
        assertEquals(1, ((List<?>) res.get("units")).size());
        assertEquals(1, ((List<?>) res.get("mops")).size());
    }

    @Test
    void context_building_details_are_loaded_via_repositories() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p-ctx");
        project.setScopeId("shared_dev_env");
        project.setUjCode("UJ-CTX");
        project.setName("Ctx");

        when(projects.findById("p-ctx")).thenReturn(Optional.of(project));
        when(applications.findFirstByProjectId("p-ctx")).thenReturn(Optional.empty());

        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-ctx");
        building.setProjectId("p-ctx");
        building.setCategory("residential");
        building.setHasNonResPart(true);

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity basement = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        basement.setId("bb-ctx");
        basement.setBuildingId("b-ctx");
        basement.setIsBasementBlock(true);
        basement.setBasementDepth(2);
        basement.setBasementHasParking(true);
        basement.setLinkedBlockIds(List.of("rb-ctx"));

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity regular = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        regular.setId("rb-ctx");
        regular.setBuildingId("b-ctx");
        regular.setIsBasementBlock(false);
        regular.setFloorsCount(9);
        regular.setParentBlocks(List.of("pb-1"));

        uz.reestrmkd.backendjpa.domain.BlockConstructionEntity construction = new uz.reestrmkd.backendjpa.domain.BlockConstructionEntity();
        construction.setBlockId("rb-ctx");
        construction.setFoundation("pile");

        uz.reestrmkd.backendjpa.domain.BlockEngineeringEntity engineering = new uz.reestrmkd.backendjpa.domain.BlockEngineeringEntity();
        engineering.setBlockId("rb-ctx");
        engineering.setHasElectricity(true);

        uz.reestrmkd.backendjpa.domain.BlockFloorMarkerEntity marker = new uz.reestrmkd.backendjpa.domain.BlockFloorMarkerEntity();
        marker.setBlockId("rb-ctx");
        marker.setMarkerKey("-1");
        marker.setIsTechnical(true);

        when(buildingsRepo.findByProjectIdIn(List.of("p-ctx"))).thenReturn(List.of(building));
        when(blocksRepo.findByBuildingIdIn(List.of("b-ctx"))).thenReturn(List.of(basement, regular));
        when(blockConstructionRepo.findByBlockIdIn(List.of("rb-ctx"))).thenReturn(List.of(construction));
        when(blockEngineeringRepo.findByBlockIdIn(List.of("rb-ctx"))).thenReturn(List.of(engineering));
        when(markersRepo.findByBlockIdIn(List.of("rb-ctx"))).thenReturn(List.of(marker));

        Map<String, Object> res = service.context("p-ctx", "shared_dev_env");

        Map<?, ?> details = (Map<?, ?>) res.get("buildingDetails");
        Map<?, ?> bData = (Map<?, ?>) details.get("b-ctx_data");
        assertEquals("residential", bData.get("category"));

        Map<?, ?> bFeatures = (Map<?, ?>) details.get("b-ctx_features");
        List<?> basements = (List<?>) bFeatures.get("basements");
        assertEquals(1, basements.size());

        Map<?, ?> block = (Map<?, ?>) details.get("rb-ctx");
        assertEquals(9, block.get("floorsCount"));
        assertEquals("pile", block.get("foundation"));

        Map<?, ?> eng = (Map<?, ?>) block.get("engineering");
        assertEquals(true, eng.get("electricity"));
        assertEquals(List.of("-1"), block.get("technicalFloors"));
    }


    @Test
    void contextBuildingSave_updates_building_using_repository_scoped_ids() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-save");
        building.setProjectId("p-save");
        building.setCategory("old");

        when(buildingsRepo.findByProjectIdIn(List.of("p-save"))).thenReturn(List.of(building));
        when(blocksRepo.findByBuildingIdIn(List.of("b-save"))).thenReturn(List.of());
        when(buildingsRepo.findById("b-save")).thenReturn(Optional.of(building));

        Map<String, Object> res = service.contextBuildingSave("p-save", Map.of(
            "buildingDetails", Map.of(
                "b-save_data", Map.of(
                    "category", "new-category",
                    "hasNonResPart", true
                )
            )
        ));

        assertEquals(true, res.get("ok"));
        assertEquals("new-category", building.getCategory());
        assertEquals(true, building.getHasNonResPart());
        verify(buildingsRepo).save(building);
    }



    @Test
    void contextBuildingSave_cleans_matrix_by_deleting_nonexistent_floor_links() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-clean");
        building.setProjectId("p-clean");

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity block = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        block.setId("11111111-1111-1111-1111-111111111111");
        block.setBuildingId("b-clean");

        uz.reestrmkd.backendjpa.domain.FloorEntity floor = new uz.reestrmkd.backendjpa.domain.FloorEntity();
        floor.setId("f-1");
        floor.setBlockId(block.getId());

        when(buildingsRepo.findByProjectIdIn(List.of("p-clean"))).thenReturn(List.of(building));
        when(blocksRepo.findByBuildingIdIn(List.of("b-clean"))).thenReturn(List.of(block));
        when(blocksRepo.findById(block.getId())).thenReturn(Optional.of(block));
        when(floorRepo.findByBlockId(block.getId())).thenReturn(List.of(floor));

        Map<String, Object> res = service.contextBuildingSave("p-clean", Map.of(
            "buildingDetails", Map.of(
                block.getId(), Map.of(
                    "floorsCount", 12,
                    "engineering", Map.of("electricity", true)
                )
            )
        ));

        assertEquals(true, res.get("ok"));
        verify(markersRepo).deleteByBlockId(block.getId());
        verify(entranceMatrixRepo).deleteByBlockIdAndFloorIdNotIn(block.getId(), List.of("f-1"));
    }

    @Test
    void contextBuildingSave_cleans_all_matrix_rows_when_block_has_no_floors() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-empty");
        building.setProjectId("p-empty");

        uz.reestrmkd.backendjpa.domain.BuildingBlockEntity block = new uz.reestrmkd.backendjpa.domain.BuildingBlockEntity();
        block.setId("22222222-2222-2222-2222-222222222222");
        block.setBuildingId("b-empty");

        when(buildingsRepo.findByProjectIdIn(List.of("p-empty"))).thenReturn(List.of(building));
        when(blocksRepo.findByBuildingIdIn(List.of("b-empty"))).thenReturn(List.of(block));
        when(blocksRepo.findById(block.getId())).thenReturn(Optional.of(block));
        when(floorRepo.findByBlockId(block.getId())).thenReturn(List.of());

        Map<String, Object> res = service.contextBuildingSave("p-empty", Map.of(
            "buildingDetails", Map.of(
                block.getId(), Map.of("floorsCount", 8)
            )
        ));

        assertEquals(true, res.get("ok"));
        verify(entranceMatrixRepo).deleteByBlockId(block.getId());
    }

    @Test
    void participants_upserts_via_repository() {
        uz.reestrmkd.backendjpa.domain.ProjectParticipantEntity existing = new uz.reestrmkd.backendjpa.domain.ProjectParticipantEntity();
        existing.setId("part-1");
        existing.setProjectId("p1");

        when(participantsRepo.findById("part-1")).thenReturn(Optional.of(existing));
        when(participantsRepo.save(existing)).thenReturn(existing);

        Map<String, Object> res = service.participants("p1", "developer", Map.of(
            "data", Map.of("id", "part-1", "name", "Acme", "inn", "123")
        ));

        assertEquals("part-1", res.get("id"));
        assertEquals("developer", existing.getRole());
        assertEquals("Acme", existing.getName());
        assertEquals("123", existing.getInn());
    }

    @Test
    void documents_upserts_via_repository() {
        uz.reestrmkd.backendjpa.domain.ProjectDocumentEntity existing = new uz.reestrmkd.backendjpa.domain.ProjectDocumentEntity();
        existing.setId("doc-1");
        existing.setProjectId("p1");

        when(documentsRepo.findById("doc-1")).thenReturn(Optional.of(existing));
        when(documentsRepo.save(existing)).thenReturn(existing);

        Map<String, Object> res = service.documents("p1", Map.of(
            "doc", Map.of("id", "doc-1", "name", "Permit", "type", "license", "date", "2026-01-01", "number", "77", "url", "http://x")
        ));

        assertEquals("doc-1", res.get("id"));
        assertEquals("Permit", existing.getName());
        assertEquals("license", existing.getDocType());
        assertEquals("77", existing.getDocNumber());
    }

    @Test
    void deleteDoc_returns_404_when_missing() {
        when(documentsRepo.existsById("missing")).thenReturn(false);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.deleteDoc("missing"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }


    @Test
    void geometryCandidates_returns_repository_payload() {
        ProjectGeometryCandidateEntity candidate = new ProjectGeometryCandidateEntity();
        candidate.setId("gc-1");
        candidate.setSourceIndex(5);
        candidate.setLabel("Land plot A");
        candidate.setProperties(new java.util.HashMap<>(Map.of("foo", "bar")));
        candidate.setGeomGeojson(new java.util.HashMap<>(Map.of("type", "Polygon")));
        candidate.setAreaM2(new java.math.BigDecimal("123.45"));
        candidate.setIsSelectedLandPlot(true);
        candidate.setAssignedBuildingId("b-1");

        when(geometryCandidateRepo.findByProjectIdOrderBySourceIndexAsc("project-geo")).thenReturn(List.of(candidate));

        List<Map<String, Object>> res = service.geometryCandidates("project-geo");

        assertEquals(1, res.size());
        assertEquals("gc-1", res.get(0).get("id"));
        assertEquals(5, res.get(0).get("sourceIndex"));
        assertEquals("bar", ((Map<?, ?>) res.get(0).get("properties")).get("foo"));
        assertEquals(true, res.get(0).get("isSelectedLandPlot"));
    }


    @Test
    void importGeometryCandidates_saves_entities_via_repository() {
        Map<String, Object> res = service.importGeometryCandidates("p-geo", List.of(
            Map.of(
                "sourceIndex", 1,
                "label", "Plot 1",
                "properties", Map.of("k", "v"),
                "geometry", Map.of("type", "Polygon")
            )
        ));

        assertEquals(true, res.get("ok"));
        assertEquals(1, res.get("imported"));
        verify(geometryCandidateRepo).save(org.mockito.ArgumentMatchers.any(ProjectGeometryCandidateEntity.class));
    }

    @Test
    void selectLandPlot_updates_selection_and_project_land_plot_fields() {
        ProjectGeometryCandidateEntity selected = new ProjectGeometryCandidateEntity();
        selected.setId("gc-1");
        selected.setProjectId("p-geo");
        selected.setGeomGeojson(new java.util.HashMap<>(Map.of("type", "Polygon")));
        selected.setAreaM2(new java.math.BigDecimal("55.5"));

        ProjectEntity project = new ProjectEntity();
        project.setId("p-geo");

        when(geometryCandidateRepo.findByIdAndProjectId("gc-1", "p-geo")).thenReturn(Optional.of(selected));
        when(geometryCandidateRepo.updateIsSelectedLandPlotByIdAndProjectId("gc-1", "p-geo", true)).thenReturn(1);
        when(projects.findById("p-geo")).thenReturn(Optional.of(project));

        Map<String, Object> res = service.selectLandPlot("p-geo", "gc-1");

        assertEquals(true, res.get("ok"));
        assertEquals(new java.math.BigDecimal("55.5"), res.get("areaM2"));
        verify(geometryCandidateRepo).updateIsSelectedLandPlotByProjectId("p-geo", false);
        verify(geometryCandidateRepo).updateIsSelectedLandPlotByIdAndProjectId("gc-1", "p-geo", true);
        assertEquals(new java.math.BigDecimal("55.5"), project.getLandPlotAreaM2());
    }

    @Test
    void selectLandPlot_throws_when_update_touches_no_rows() {
        ProjectGeometryCandidateEntity selected = new ProjectGeometryCandidateEntity();
        selected.setId("gc-1");
        selected.setProjectId("p-geo");

        ProjectEntity project = new ProjectEntity();
        project.setId("p-geo");

        when(projects.findById("p-geo")).thenReturn(Optional.of(project));
        when(geometryCandidateRepo.findByIdAndProjectId("gc-1", "p-geo")).thenReturn(Optional.of(selected));
        when(geometryCandidateRepo.updateIsSelectedLandPlotByIdAndProjectId("gc-1", "p-geo", true)).thenReturn(0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.selectLandPlot("p-geo", "gc-1"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertEquals("Candidate not found", ex.getReason());
    }

    @Test
    void selectLandPlot_throws_when_project_not_found_before_updates() {
        when(projects.findById("p-missing")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.selectLandPlot("p-missing", "gc-1"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertEquals("Project not found", ex.getReason());
        verify(geometryCandidateRepo, never()).updateIsSelectedLandPlotByProjectId(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
        verify(geometryCandidateRepo, never()).updateIsSelectedLandPlotByIdAndProjectId(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void unselectLandPlot_clears_selection_and_project_land_plot_fields() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p-geo");
        project.setLandPlotGeojson(new java.util.HashMap<>(Map.of("type", "Polygon")));
        project.setLandPlotAreaM2(new java.math.BigDecimal("10"));

        when(projects.findById("p-geo")).thenReturn(Optional.of(project));

        Map<String, Object> res = service.unselectLandPlot("p-geo");

        assertEquals(true, res.get("ok"));
        verify(geometryCandidateRepo).updateIsSelectedLandPlotByProjectId("p-geo", false);
        assertEquals(null, project.getLandPlotGeojson());
        assertEquals(null, project.getLandPlotAreaM2());
    }

    @Test
    void unselectLandPlot_throws_when_project_not_found_before_updates() {
        when(projects.findById("p-missing")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.unselectLandPlot("p-missing"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertEquals("Project not found", ex.getReason());
        verify(geometryCandidateRepo, never()).updateIsSelectedLandPlotByProjectId(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    void deleteGeometryCandidate_uses_repository_scoped_delete() {
        when(geometryCandidateRepo.deleteByIdAndProjectId("gc-9", "p-geo")).thenReturn(1L);

        Map<String, Object> res = service.deleteGeometryCandidate("p-geo", "gc-9");

        assertEquals(true, res.get("ok"));
    }

    @Test
    void selectBuildingGeometry_requires_building_in_project() {
        when(buildingsRepo.findByIdAndProjectId("b-missing", "p-geo")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.selectBuildingGeometry("p-geo", "b-missing", "gc-1"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertEquals("Building not found", ex.getReason());
    }

    @Test
    void selectBuildingGeometry_requires_building_id() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.selectBuildingGeometry("p-geo", " ", "gc-1"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("buildingId is required", ex.getReason());
    }

    @Test
    void selectBuildingGeometry_assigns_building_and_returns_area() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-1");
        building.setProjectId("p-geo");

        ProjectGeometryCandidateEntity candidate = new ProjectGeometryCandidateEntity();
        candidate.setId("gc-1");
        candidate.setProjectId("p-geo");
        candidate.setAreaM2(new java.math.BigDecimal("88.8"));

        when(buildingsRepo.findByIdAndProjectId("b-1", "p-geo")).thenReturn(Optional.of(building));
        when(geometryCandidateRepo.findByIdAndProjectId("gc-1", "p-geo")).thenReturn(Optional.of(candidate));
        when(geometryCandidateRepo.updateAssignedBuildingByIdAndProjectId("gc-1", "p-geo", "b-1")).thenReturn(1);

        Map<String, Object> res = service.selectBuildingGeometry("p-geo", "b-1", "gc-1");

        assertEquals(true, res.get("ok"));
        assertEquals(new java.math.BigDecimal("88.8"), res.get("areaM2"));
        verify(geometryCandidateRepo).clearAssignedBuildingByProjectIdAndBuildingId("p-geo", "b-1");
        verify(geometryCandidateRepo).updateAssignedBuildingByIdAndProjectId("gc-1", "p-geo", "b-1");
    }

    @Test
    void selectBuildingGeometry_throws_when_assignment_update_touches_no_rows() {
        uz.reestrmkd.backendjpa.domain.BuildingEntity building = new uz.reestrmkd.backendjpa.domain.BuildingEntity();
        building.setId("b-1");
        building.setProjectId("p-geo");

        ProjectGeometryCandidateEntity candidate = new ProjectGeometryCandidateEntity();
        candidate.setId("gc-1");
        candidate.setProjectId("p-geo");

        when(buildingsRepo.findByIdAndProjectId("b-1", "p-geo")).thenReturn(Optional.of(building));
        when(geometryCandidateRepo.findByIdAndProjectId("gc-1", "p-geo")).thenReturn(Optional.of(candidate));
        when(geometryCandidateRepo.updateAssignedBuildingByIdAndProjectId("gc-1", "p-geo", "b-1")).thenReturn(0);

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.selectBuildingGeometry("p-geo", "b-1", "gc-1"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertEquals("Candidate not found", ex.getReason());
    }


    @Test
    void fromApplication_requires_scope() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.fromApplication(Map.of()));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("scope is required", ex.getReason());
    }

    @Test
    void fromApplication_creates_project_and_application() {
        ProjectEntity savedProject = new ProjectEntity();
        savedProject.setId("p-new");
        savedProject.setUjCode("UJ123456");

        ApplicationEntity savedApp = new ApplicationEntity();
        savedApp.setId("app-new");

        when(projects.save(org.mockito.ArgumentMatchers.any(ProjectEntity.class))).thenReturn(savedProject);
        when(applications.save(org.mockito.ArgumentMatchers.any(ApplicationEntity.class))).thenReturn(savedApp);

        Map<String, Object> res = service.fromApplication(Map.of(
            "scope", "shared_dev_env",
            "appData", Map.of(
                "applicant", "Test Applicant",
                "source", "EPIGU",
                "externalId", "EXT-1",
                "cadastre", "10:10:10"
            )
        ));

        assertEquals(true, res.get("ok"));
        assertEquals("p-new", res.get("projectId"));
        assertEquals("app-new", res.get("applicationId"));
        assertEquals("UJ123456", res.get("ujCode"));
    }

    @Test
    void integrationStatus_updates_application_integration_data() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-9");
        app.setProjectId("project-9");
        app.setIntegrationData(new java.util.HashMap<>(Map.of("existing", "yes")));

        when(applications.findFirstByProjectId("project-9")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.integrationStatus("project-9", Map.of(
            "field", "status",
            "status", "SYNC_OK"
        ));

        assertEquals(true, res.get("ok"));
        assertEquals("yes", app.getIntegrationData().get("existing"));
        assertEquals("SYNC_OK", app.getIntegrationData().get("status"));
        assertEquals(app.getIntegrationData(), res.get("integrationData"));
    }

    @Test
    void integrationStatus_updates_custom_field_from_body() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-10");
        app.setProjectId("project-10");

        when(applications.findFirstByProjectId("project-10")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.integrationStatus("project-10", Map.of(
            "field", "cadastre",
            "status", "SYNC_PENDING"
        ));

        assertEquals(true, res.get("ok"));
        assertEquals("SYNC_PENDING", app.getIntegrationData().get("cadastre"));
    }

    @Test
    void integrationStatus_requires_field() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-11");
        app.setProjectId("project-11");

        when(applications.findFirstByProjectId("project-11")).thenReturn(Optional.of(app));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.integrationStatus("project-11", Map.of("status", "SYNC_PENDING")));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("field is required", ex.getReason());
    }



    @Test
    void integrationStatus_accepts_integrationStatus_fallback_key() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-13");
        app.setProjectId("project-13");

        when(applications.findFirstByProjectId("project-13")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.integrationStatus("project-13", Map.of(
            "field", "registry",
            "integrationStatus", "SYNC_DONE"
        ));

        assertEquals(true, res.get("ok"));
        assertEquals("SYNC_DONE", app.getIntegrationData().get("registry"));
    }

    @Test
    void integrationGet_returns_raw_integration_map() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-12");
        app.setProjectId("project-12");
        app.setIntegrationData(new java.util.HashMap<>(Map.of("status", "SYNC_OK")));

        when(applications.findFirstByProjectId("project-12")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.integrationGet("project-12");

        assertEquals("SYNC_OK", res.get("status"));
        assertEquals(1, res.size());
    }


    @Test
    void integrationGet_returns_empty_map_when_integration_data_is_missing() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-14");
        app.setProjectId("project-14");
        app.setIntegrationData(null);

        when(applications.findFirstByProjectId("project-14")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.integrationGet("project-14");

        assertEquals(0, res.size());
    }

    @Test
    void integrationStatus_allows_null_status_value() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-15");
        app.setProjectId("project-15");

        when(applications.findFirstByProjectId("project-15")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.integrationStatus("project-15", Map.of("field", "registry"));

        assertEquals(true, res.get("ok"));
        assertEquals(true, app.getIntegrationData().containsKey("registry"));
        assertEquals(null, app.getIntegrationData().get("registry"));
    }

    @Test
    void integrationStatus_returns_404_when_application_missing() {
        when(applications.findFirstByProjectId("project-missing")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.integrationStatus("project-missing", Map.of("field", "status", "status", "SYNC")));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertEquals("Application not found", ex.getReason());
    }

    @Test
    void integrationGet_returns_404_when_application_missing() {
        when(applications.findFirstByProjectId("project-missing")).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.integrationGet("project-missing"));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
        assertEquals("Application not found", ex.getReason());
    }

    @Test
    void integrationStatus_requires_field_when_body_is_null() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-16");
        app.setProjectId("project-16");

        when(applications.findFirstByProjectId("project-16")).thenReturn(Optional.of(app));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
            () -> service.integrationStatus("project-16", null));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("field is required", ex.getReason());
    }

    @Test
    void integrationStatus_prefers_status_over_integrationStatus_when_both_present() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-17");
        app.setProjectId("project-17");

        when(applications.findFirstByProjectId("project-17")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.integrationStatus("project-17", Map.of(
            "field", "registry",
            "status", "PRIMARY",
            "integrationStatus", "FALLBACK"
        ));

        assertEquals(true, res.get("ok"));
        assertEquals("PRIMARY", app.getIntegrationData().get("registry"));
    }

    @Test
    void integrationStatus_preserves_existing_integration_data_in_response_payload() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-18");
        app.setProjectId("project-18");
        app.setIntegrationData(new java.util.HashMap<>(Map.of("existing", "yes")));

        when(applications.findFirstByProjectId("project-18")).thenReturn(Optional.of(app));

        Map<String, Object> res = service.integrationStatus("project-18", Map.of(
            "field", "registry",
            "status", "SYNCED"
        ));

        Map<?, ?> payload = (Map<?, ?>) res.get("integrationData");
        assertEquals("yes", payload.get("existing"));
        assertEquals("SYNCED", payload.get("registry"));
    }

    @Test
    void integrationStatus_persists_changes_via_application_repository() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-19");
        app.setProjectId("project-19");

        when(applications.findFirstByProjectId("project-19")).thenReturn(Optional.of(app));

        service.integrationStatus("project-19", Map.of("field", "status", "status", "SYNC_OK"));

        verify(applications).save(app);
    }

    @Test
    void integrationStatus_does_not_save_when_field_validation_fails() {
        ApplicationEntity app = new ApplicationEntity();
        app.setId("app-20");
        app.setProjectId("project-20");

        when(applications.findFirstByProjectId("project-20")).thenReturn(Optional.of(app));

        assertThrows(ResponseStatusException.class,
            () -> service.integrationStatus("project-20", Map.of("status", "SYNC_FAIL")));

        verify(applications, never()).save(app);
    }

}
