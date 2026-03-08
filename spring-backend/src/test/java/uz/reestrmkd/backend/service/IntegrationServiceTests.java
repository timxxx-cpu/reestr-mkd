package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.integration.service.IntegrationService;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.workflow.model.ApplicationEntity;
import uz.reestrmkd.backend.domain.workflow.repository.ApplicationJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntegrationServiceTests {

    @Mock
    private ApplicationJpaRepository applicationJpaRepository;
    @Mock
    private BuildingJpaRepository buildingJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;

    @Test
    void shouldReadLatestIntegrationStatusFromApplication() {
        UUID projectId = UUID.randomUUID();
        ApplicationEntity application = new ApplicationEntity();
        application.setIntegrationData(Map.of("buildingsStatus", "DONE"));

        when(applicationJpaRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId))
            .thenReturn(Optional.of(application));

        IntegrationService service = new IntegrationService(applicationJpaRepository, buildingJpaRepository, unitJpaRepository);

        Map<String, Object> response = service.getLatestIntegrationStatus(projectId);

        assertThat(response).containsEntry("buildingsStatus", "DONE");
    }

    @Test
    void shouldUpdateLatestApplicationIntegrationStatus() {
        UUID projectId = UUID.randomUUID();
        UUID applicationId = UUID.randomUUID();
        ApplicationEntity application = new ApplicationEntity();
        application.setId(applicationId);
        application.setIntegrationData(new LinkedHashMap<>(Map.of("buildingsStatus", "PENDING")));

        when(applicationJpaRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId))
            .thenReturn(Optional.of(application));

        IntegrationService service = new IntegrationService(applicationJpaRepository, buildingJpaRepository, unitJpaRepository);

        Map<String, Object> response = service.updateLatestIntegrationStatus(projectId, "unitsStatus", "DONE");

        ArgumentCaptor<ApplicationEntity> applicationCaptor = ArgumentCaptor.forClass(ApplicationEntity.class);
        verify(applicationJpaRepository).save(applicationCaptor.capture());
        ApplicationEntity saved = applicationCaptor.getValue();

        assertThat(response)
            .containsEntry("buildingsStatus", "PENDING")
            .containsEntry("unitsStatus", "DONE");
        assertThat(saved.getIntegrationData())
            .containsEntry("buildingsStatus", "PENDING")
            .containsEntry("unitsStatus", "DONE");
        assertThat(saved.getUpdatedAt()).isNotNull();
    }

    @Test
    void shouldRejectUnsupportedIntegrationField() {
        IntegrationService service = new IntegrationService(applicationJpaRepository, buildingJpaRepository, unitJpaRepository);

        assertThatThrownBy(() -> service.updateLatestIntegrationStatus(UUID.randomUUID(), "badField", "DONE"))
            .isInstanceOf(ApiException.class)
            .hasMessage("Unsupported integration field: badField");
    }

    @Test
    void shouldFormatBuildingCadastreBeforeUpdate() {
        UUID buildingId = UUID.randomUUID();
        when(buildingJpaRepository.updateCadastreNumber(eq(buildingId), eq("12:34:56:78:90:12345"), any()))
            .thenReturn(1);

        IntegrationService service = new IntegrationService(applicationJpaRepository, buildingJpaRepository, unitJpaRepository);

        String response = service.updateBuildingCadastre(buildingId, "123456789012345");

        verify(buildingJpaRepository).updateCadastreNumber(eq(buildingId), eq("12:34:56:78:90:12345"), any());
        assertThat(response).isEqualTo("12:34:56:78:90:12345");
    }

    @Test
    void shouldTrimUnitCadastreBeforeUpdate() {
        UUID unitId = UUID.randomUUID();
        when(unitJpaRepository.updateCadastreNumber(eq(unitId), eq("12:34"), any()))
            .thenReturn(1);

        IntegrationService service = new IntegrationService(applicationJpaRepository, buildingJpaRepository, unitJpaRepository);

        String response = service.updateUnitCadastre(unitId, " 12:34 ");

        verify(unitJpaRepository).updateCadastreNumber(eq(unitId), eq("12:34"), any());
        assertThat(response).isEqualTo("12:34");
    }

    @Test
    void shouldPersistNullUnitCadastreForBlankInput() {
        UUID unitId = UUID.randomUUID();
        when(unitJpaRepository.updateCadastreNumber(eq(unitId), eq(null), any()))
            .thenReturn(1);

        IntegrationService service = new IntegrationService(applicationJpaRepository, buildingJpaRepository, unitJpaRepository);

        String response = service.updateUnitCadastre(unitId, "   ");

        verify(unitJpaRepository).updateCadastreNumber(eq(unitId), eq(null), any());
        assertThat(response).isNull();
    }
}
