package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationStepEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationHistoryJpaRepository;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationLockJpaRepository;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationStepJpaRepository;
import uz.reestrmkd.backend.domain.workflow.service.ApplicationRepositoryService;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ApplicationRepositoryServiceTests {

    @Mock
    private ApplicationJpaRepository applicationRepo;
    @Mock
    private ApplicationHistoryJpaRepository historyRepo;
    @Mock
    private ApplicationStepJpaRepository stepRepo;
    @Mock
    private ApplicationLockJpaRepository lockRepo;

    @Test
    void shouldCreateOrUpdateStepBlockStatusesViaJpa() {
        UUID projectId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();
        ApplicationEntity application = new ApplicationEntity();
        application.setId(applicationId);

        when(applicationRepo.findByProjectIdAndScopeId(projectId, "scope-1")).thenReturn(Optional.of(application));
        when(stepRepo.findByApplicationIdAndStepIndex(applicationId, 4)).thenReturn(Optional.empty());
        when(stepRepo.save(any(ApplicationStepEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ApplicationRepositoryService service = new ApplicationRepositoryService(applicationRepo, historyRepo, stepRepo, lockRepo);
        UUID result = service.saveStepBlockStatuses(projectId, "scope-1", 4, Map.of("block-1", "ready"));

        ArgumentCaptor<ApplicationStepEntity> captor = ArgumentCaptor.forClass(ApplicationStepEntity.class);
        verify(stepRepo).save(captor.capture());
        assertThat(result).isEqualTo(applicationId);
        assertThat(captor.getValue().getApplicationId()).isEqualTo(applicationId);
        assertThat(captor.getValue().getStepIndex()).isEqualTo(4);
        assertThat(captor.getValue().getBlockStatuses()).containsEntry("block-1", "ready");
        assertThat(captor.getValue().getIsCompleted()).isFalse();
        assertThat(captor.getValue().getIsVerified()).isFalse();
    }
}
