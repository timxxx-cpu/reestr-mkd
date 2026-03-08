package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.common.api.MapPayloadDto;
import uz.reestrmkd.backend.domain.common.api.PagedItemsResponseDto;
import uz.reestrmkd.backend.domain.project.api.ProjectController;
import uz.reestrmkd.backend.domain.project.service.ProjectApplicationQueryService;
import uz.reestrmkd.backend.domain.project.service.ProjectCreationService;
import uz.reestrmkd.backend.domain.project.service.ProjectListQueryService;
import uz.reestrmkd.backend.domain.project.service.ProjectMapOverviewService;
import uz.reestrmkd.backend.domain.project.service.ProjectTepSummaryService;
import uz.reestrmkd.backend.domain.registry.api.TepSummaryMetricDto;
import uz.reestrmkd.backend.domain.registry.api.TepSummaryMopDto;
import uz.reestrmkd.backend.domain.registry.api.TepSummaryResponseDto;
import uz.reestrmkd.backend.domain.registry.service.RegistryValidationService;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectControllerTests {

    @Mock
    private RegistryValidationService registryValidationService;
    @Mock
    private ProjectCreationService projectCreationService;
    @Mock
    private ProjectApplicationQueryService projectApplicationQueryService;
    @Mock
    private ProjectListQueryService projectListQueryService;
    @Mock
    private ProjectMapOverviewService projectMapOverviewService;
    @Mock
    private ProjectTepSummaryService projectTepSummaryService;

    @Test
    void shouldDelegateCreateFromApplicationToService() {
        ProjectController controller = new ProjectController(registryValidationService, projectCreationService, projectApplicationQueryService, projectListQueryService, projectMapOverviewService, projectTepSummaryService);
        MapPayloadDto payload = new MapPayloadDto(Map.of("scope", "scope-1"));
        ActorPrincipal actor = new ActorPrincipal("u1", "technician", "bff");
        UUID projectId = UUID.randomUUID();

        when(projectCreationService.createFromApplication(payload, actor))
            .thenReturn(Map.of("ok", true, "projectId", projectId, "applicationId", UUID.randomUUID(), "ujCode", "UJ000001"));

        Map<String, Object> response = controller.createFromApplication(payload, actor).data();

        verify(projectCreationService).createFromApplication(payload, actor);
        assertThat(response).containsEntry("ok", true);
        assertThat(response).containsEntry("projectId", projectId);
    }

    @Test
    void shouldDelegateSummaryCountsToQueryService() {
        ProjectController controller = new ProjectController(registryValidationService, projectCreationService, projectApplicationQueryService, projectListQueryService, projectMapOverviewService, projectTepSummaryService);
        ActorPrincipal actor = new ActorPrincipal("u1", "technician", "bff");

        when(projectApplicationQueryService.summaryCounts("scope-1", "mine", actor))
            .thenReturn(Map.of("work", 1, "review", 0, "integration", 0, "pendingDecline", 0, "declined", 0, "registryApplications", 0, "registryComplexes", 0));

        Map<String, Object> response = controller.summaryCounts("scope-1", "mine", actor).data();

        verify(projectApplicationQueryService).summaryCounts("scope-1", "mine", actor);
        assertThat(response).containsEntry("work", 1);
    }

    @Test
    void shouldDelegateTepSummaryToService() {
        ProjectController controller = new ProjectController(registryValidationService, projectCreationService, projectApplicationQueryService, projectListQueryService, projectMapOverviewService, projectTepSummaryService);
        UUID projectId = UUID.randomUUID();
        TepSummaryResponseDto summary = new TepSummaryResponseDto(
            new BigDecimal("100.00"),
            new BigDecimal("90.00"),
            new TepSummaryMetricDto(new BigDecimal("50.00"), 5),
            new TepSummaryMetricDto(new BigDecimal("10.00"), 1),
            new TepSummaryMetricDto(new BigDecimal("20.00"), 2),
            new TepSummaryMetricDto(new BigDecimal("10.00"), 4),
            new TepSummaryMopDto(new BigDecimal("15.00")),
            3,
            12,
            new BigDecimal("33.00")
        );

        when(projectTepSummaryService.getTepSummary(projectId)).thenReturn(summary);

        TepSummaryResponseDto response = controller.getTepSummary(projectId);

        verify(projectTepSummaryService).getTepSummary(projectId);
        assertThat(response).isSameAs(summary);
    }

    @Test
    void shouldDelegateProjectListToService() {
        ProjectController controller = new ProjectController(registryValidationService, projectCreationService, projectApplicationQueryService, projectListQueryService, projectMapOverviewService, projectTepSummaryService);
        ActorPrincipal actor = new ActorPrincipal("u1", "technician", "bff");
        PagedItemsResponseDto paged = new PagedItemsResponseDto(List.of(Map.of("id", UUID.randomUUID())), 1, 20, 1, 1);

        when(projectListQueryService.getProjects("scope-1", "IN_PROGRESS", "DRAFT", "mine", "abc", 1, 20, actor))
            .thenReturn(paged);

        PagedItemsResponseDto response = controller.getProjects("scope-1", "IN_PROGRESS", "DRAFT", "mine", "abc", 1, 20, actor);

        verify(projectListQueryService).getProjects("scope-1", "IN_PROGRESS", "DRAFT", "mine", "abc", 1, 20, actor);
        assertThat(response).isSameAs(paged);
    }

    @Test
    void shouldDelegateMapOverviewToService() {
        ProjectController controller = new ProjectController(registryValidationService, projectCreationService, projectApplicationQueryService, projectListQueryService, projectMapOverviewService, projectTepSummaryService);
        Map<String, Object> payload = Map.of("items", List.of(Map.of("id", UUID.randomUUID())));

        when(projectMapOverviewService.mapOverview("scope-1")).thenReturn(payload);

        Map<String, Object> response = controller.mapOverview("scope-1").data();

        verify(projectMapOverviewService).mapOverview("scope-1");
        assertThat(response).isSameAs(payload);
    }
}
