package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.project.service.ProjectApplicationQueryService;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectApplicationQueryServiceTests {

    @Mock
    private ApplicationJpaRepository applicationJpaRepository;

    @Test
    void shouldCalculateSummaryCountsForMineAssignee() {
        ProjectApplicationQueryService service = new ProjectApplicationQueryService(applicationJpaRepository);
        ActorPrincipal actor = new ActorPrincipal("u1", "technician", "bff");

        when(applicationJpaRepository.findByScopeIdAndAssigneeName("scope-1", "u1")).thenReturn(List.of(
            application("IN_PROGRESS", "DRAFT"),
            application("IN_PROGRESS", "REVIEW"),
            application("IN_PROGRESS", "INTEGRATION"),
            application("DECLINED", "PENDING_DECLINE"),
            application("COMPLETED", "DONE")
        ));

        Map<String, Object> response = service.summaryCounts("scope-1", "mine", actor);

        verify(applicationJpaRepository).findByScopeIdAndAssigneeName("scope-1", "u1");
        assertThat(response).containsEntry("work", 1);
        assertThat(response).containsEntry("review", 1);
        assertThat(response).containsEntry("integration", 1);
        assertThat(response).containsEntry("pendingDecline", 1);
        assertThat(response).containsEntry("declined", 1);
        assertThat(response).containsEntry("registryApplications", 2);
        assertThat(response).containsEntry("registryComplexes", 1);
    }

    @Test
    void shouldRequireActorForMineSummaryCounts() {
        ProjectApplicationQueryService service = new ProjectApplicationQueryService(applicationJpaRepository);

        assertThatThrownBy(() -> service.summaryCounts("scope-1", "mine", null))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Auth context required");
    }

    @Test
    void shouldReturnExternalApplicationsViaJpa() {
        ProjectApplicationQueryService service = new ProjectApplicationQueryService(applicationJpaRepository);
        ApplicationEntity application = application("IN_PROGRESS", "DRAFT");
        application.setId(UUID.randomUUID());
        application.setProjectId(UUID.randomUUID());
        application.setScopeId("scope-1");
        application.setExternalSource("integration");
        application.setExternalId("ext-1");
        application.setSubmissionDate(Instant.parse("2026-03-07T10:15:30Z"));

        when(applicationJpaRepository.findByExternalSourceIsNotNullAndScopeIdOrderBySubmissionDateDesc("scope-1"))
            .thenReturn(List.of(application));

        List<Map<String, Object>> response = service.externalApplications("scope-1");

        verify(applicationJpaRepository).findByExternalSourceIsNotNullAndScopeIdOrderBySubmissionDateDesc("scope-1");
        assertThat(response).hasSize(1);
        assertThat(response.getFirst()).containsEntry("external_source", "integration");
        assertThat(response.getFirst()).containsEntry("external_id", "ext-1");
    }

    @Test
    void shouldResolveLatestApplicationIdViaJpa() {
        ProjectApplicationQueryService service = new ProjectApplicationQueryService(applicationJpaRepository);
        UUID projectId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();
        ApplicationEntity application = application("IN_PROGRESS", "DRAFT");
        application.setId(applicationId);

        when(applicationJpaRepository.findFirstByProjectIdAndScopeIdOrderByCreatedAtDesc(projectId, "scope-1"))
            .thenReturn(Optional.of(application));

        UUID resolved = service.resolveApplicationId(projectId, "scope-1");

        verify(applicationJpaRepository).findFirstByProjectIdAndScopeIdOrderByCreatedAtDesc(projectId, "scope-1");
        assertThat(resolved).isEqualTo(applicationId);
    }

    private ApplicationEntity application(String status, String workflowSubstatus) {
        ApplicationEntity application = new ApplicationEntity();
        application.setStatus(status);
        application.setWorkflowSubstatus(workflowSubstatus);
        return application;
    }
}
