package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.common.api.PagedItemsResponseDto;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.project.service.ProjectListQueryService;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectListQueryServiceTests {

    @Mock
    private ApplicationJpaRepository applicationJpaRepository;
    @Mock
    private ProjectJpaRepository projectJpaRepository;

    @Test
    void shouldBuildPagedProjectListFromJpaQueries() {
        ProjectListQueryService service = new ProjectListQueryService(applicationJpaRepository, projectJpaRepository);
        ActorPrincipal actor = new ActorPrincipal("u1", "technician", "bff");
        UUID projectId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();

        when(applicationJpaRepository.findByScopeIdAndAssigneeNameOrderByUpdatedAtDesc("scope-1", "u1"))
            .thenReturn(List.of(application(projectId, applicationId, "IN_PROGRESS", "DRAFT", "INT-1", "ext-1", "Applicant A", "u1", Instant.parse("2026-03-07T10:15:30Z"))));
        when(projectJpaRepository.findProjectListRowsByScopeIdAndIdIn("scope-1", List.of(projectId)))
            .thenReturn(List.of(project(projectId, "UJ000001", "12:34", "Project A", "Tashkent", "Street 1", 2L, Instant.parse("2026-03-07T09:15:30Z"))));

        PagedItemsResponseDto response = service.getProjects("scope-1", "IN_PROGRESS", "DRAFT", "mine", null, 1, 20, actor);

        verify(applicationJpaRepository).findByScopeIdAndAssigneeNameOrderByUpdatedAtDesc("scope-1", "u1");
        verify(projectJpaRepository).findProjectListRowsByScopeIdAndIdIn("scope-1", List.of(projectId));
        assertThat(response.total()).isEqualTo(1);
        assertThat(response.totalPages()).isEqualTo(1);
        assertThat(response.items()).hasSize(1);

        @SuppressWarnings("unchecked")
        Map<String, Object> item = (Map<String, Object>) response.items().getFirst();
        assertThat(item).containsEntry("id", projectId);
        assertThat(item).containsEntry("ujCode", "UJ000001");
        assertThat(item).containsEntry("applicationId", applicationId);
        assertThat(item).containsEntry("name", "Project A");
        assertThat(item).containsKey("availableActions");

        @SuppressWarnings("unchecked")
        Map<String, Object> applicationInfo = (Map<String, Object>) item.get("applicationInfo");
        assertThat(applicationInfo).containsEntry("internalNumber", "INT-1");
        assertThat(applicationInfo).containsEntry("status", "IN_PROGRESS");
        assertThat(applicationInfo).containsEntry("workflowSubstatus", "DRAFT");
    }

    @Test
    void shouldRequireActorForMineAssignee() {
        ProjectListQueryService service = new ProjectListQueryService(applicationJpaRepository, projectJpaRepository);

        assertThatThrownBy(() -> service.getProjects("scope-1", null, null, "mine", null, 1, 20, null))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Auth context required");
    }

    private ApplicationEntity application(
        UUID projectId,
        UUID applicationId,
        String status,
        String workflowSubstatus,
        String internalNumber,
        String externalId,
        String applicant,
        String assigneeName,
        Instant updatedAt
    ) {
        ApplicationEntity application = new ApplicationEntity();
        application.setId(applicationId);
        application.setProjectId(projectId);
        application.setStatus(status);
        application.setWorkflowSubstatus(workflowSubstatus);
        application.setInternalNumber(internalNumber);
        application.setExternalId(externalId);
        application.setApplicant(applicant);
        application.setAssigneeName(assigneeName);
        application.setUpdatedAt(updatedAt);
        return application;
    }

    private ProjectJpaRepository.ProjectListRow project(
        UUID projectId,
        String ujCode,
        String cadastreNumber,
        String name,
        String region,
        String address,
        Long buildingsCount,
        Instant updatedAt
    ) {
        return new ProjectJpaRepository.ProjectListRow() {
            @Override
            public UUID getId() {
                return projectId;
            }

            @Override
            public String getUjCode() {
                return ujCode;
            }

            @Override
            public String getCadastreNumber() {
                return cadastreNumber;
            }

            @Override
            public String getName() {
                return name;
            }

            @Override
            public String getRegion() {
                return region;
            }

            @Override
            public String getAddress() {
                return address;
            }

            @Override
            public UUID getAddressId() {
                return null;
            }

            @Override
            public String getConstructionStatus() {
                return "project";
            }

            @Override
            public Instant getUpdatedAt() {
                return updatedAt;
            }

            @Override
            public Instant getCreatedAt() {
                return updatedAt;
            }

            @Override
            public Long getBuildingsCount() {
                return buildingsCount;
            }
        };
    }
}
