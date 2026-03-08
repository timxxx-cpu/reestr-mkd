package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.common.api.MapPayloadDto;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.project.service.ProjectCreationService;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectCreationServiceTests {

    @Mock
    private ProjectJpaRepository projectJpaRepository;
    @Mock
    private ApplicationJpaRepository applicationJpaRepository;

    @Test
    void shouldCreateProjectAndApplicationViaJpa() {
        ProjectCreationService service = service();
        ActorPrincipal actor = new ActorPrincipal("u1", "technician", "bff");
        Instant submittedAt = Instant.parse("2026-03-07T10:15:30Z");

        when(applicationJpaRepository.countInProgressByScopeIdAndCadastreNumber("scope-1", "12:34:56")).thenReturn(0L);
        when(projectJpaRepository.findUjCodesByScopeIdOrderByUjCodeDesc("scope-1")).thenReturn(List.of("UJ000009"));
        when(projectJpaRepository.save(any(ProjectEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(applicationJpaRepository.save(any(ApplicationEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> response = service.createFromApplication(
            new MapPayloadDto(Map.of(
                "scope", "scope-1",
                "appData", Map.of(
                    "cadastre", "12:34:56",
                    "applicant", "Developer A",
                    "address", "Street 1",
                    "submissionDate", submittedAt.toString(),
                    "source", "integration",
                    "externalId", "ext-1"
                )
            )),
            actor
        );

        ArgumentCaptor<ProjectEntity> projectCaptor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projectJpaRepository).save(projectCaptor.capture());
        assertThat(projectCaptor.getValue().getScopeId()).isEqualTo("scope-1");
        assertThat(projectCaptor.getValue().getUjCode()).isEqualTo("UJ000010");
        assertThat(projectCaptor.getValue().getName()).isEqualTo("ЖК от Developer A");
        assertThat(projectCaptor.getValue().getCadastreNumber()).isEqualTo("12:34:56");
        assertThat(projectCaptor.getValue().getConstructionStatus()).isEqualTo("Проектный");

        ArgumentCaptor<ApplicationEntity> applicationCaptor = ArgumentCaptor.forClass(ApplicationEntity.class);
        verify(applicationJpaRepository).save(applicationCaptor.capture());
        assertThat(applicationCaptor.getValue().getProjectId()).isEqualTo(projectCaptor.getValue().getId());
        assertThat(applicationCaptor.getValue().getScopeId()).isEqualTo("scope-1");
        assertThat(applicationCaptor.getValue().getAssigneeName()).isEqualTo("u1");
        assertThat(applicationCaptor.getValue().getStatus()).isEqualTo("IN_PROGRESS");
        assertThat(applicationCaptor.getValue().getWorkflowSubstatus()).isEqualTo("DRAFT");
        assertThat(applicationCaptor.getValue().getSubmissionDate()).isEqualTo(submittedAt);

        assertThat(response).containsEntry("ok", true);
        assertThat(response).containsEntry("ujCode", "UJ000010");
        assertThat(response).containsKey("projectId");
        assertThat(response).containsKey("applicationId");
    }

    @Test
    void shouldBlockReapplicationWhenCadastreAlreadyInProgress() {
        ProjectCreationService service = service();

        when(applicationJpaRepository.countInProgressByScopeIdAndCadastreNumber("scope-1", "12:34:56")).thenReturn(1L);

        assertThatThrownBy(() -> service.createFromApplication(
            new MapPayloadDto(Map.of(
                "scope", "scope-1",
                "appData", Map.of("cadastre", "12:34:56")
            )),
            null
        ))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("активное заявление");
    }

    private ProjectCreationService service() {
        return new ProjectCreationService(projectJpaRepository, applicationJpaRepository);
    }
}
