package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.integration.api.IntegrationController;
import uz.reestrmkd.backend.domain.integration.service.IntegrationService;
import uz.reestrmkd.backend.domain.registry.api.CadastreUpdateRequestDto;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IntegrationControllerTests {

    @Mock
    private IntegrationService integrationService;

    private IntegrationController controller;

    @BeforeEach
    void setUp() {
        controller = new IntegrationController(integrationService, new SecurityPolicyService());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldDelegateGetStatusToService() {
        UUID projectId = UUID.randomUUID();
        Map<String, Object> payload = Map.of("buildingsStatus", "DONE");
        when(integrationService.getLatestIntegrationStatus(projectId)).thenReturn(payload);

        Map<String, Object> response = controller.getStatus(projectId).data();

        verify(integrationService).getLatestIntegrationStatus(projectId);
        assertThat(response).isSameAs(payload);
    }

    @Test
    void shouldDelegateUpdateStatusToService() {
        UUID projectId = UUID.randomUUID();
        setActor("technician");
        Map<String, Object> integrationData = Map.of("unitsStatus", "DONE");
        when(integrationService.updateLatestIntegrationStatus(projectId, "unitsStatus", "DONE"))
            .thenReturn(integrationData);

        Map<String, Object> response = controller.updateStatus(
            projectId,
            Map.of("field", "unitsStatus", "status", "DONE")
        ).data();

        verify(integrationService).updateLatestIntegrationStatus(projectId, "unitsStatus", "DONE");
        assertThat(response).containsEntry("ok", true);
        assertThat(response).containsEntry("integrationData", integrationData);
    }

    @Test
    void shouldRequireRequestBodyForUpdateStatus() {
        setActor("technician");

        assertThatThrownBy(() -> controller.updateStatus(UUID.randomUUID(), null))
            .isInstanceOf(ApiException.class)
            .hasMessage("Request body is required");
    }

    @Test
    void shouldUpdateBuildingCadastreThroughService() {
        UUID buildingId = UUID.randomUUID();
        setActor("technician");
        when(integrationService.updateBuildingCadastre(buildingId, "123456789012345"))
            .thenReturn("12:34:56:78:90:12345");

        Map<String, Object> response = controller.updateBuildingCadastre(
            buildingId,
            new CadastreUpdateRequestDto("123456789012345")
        ).data();

        verify(integrationService).updateBuildingCadastre(buildingId, "123456789012345");
        assertThat(response)
            .containsEntry("ok", true)
            .containsEntry("id", buildingId)
            .containsEntry("cadastre", "12:34:56:78:90:12345");
    }

    @Test
    void shouldUpdateUnitCadastreThroughService() {
        UUID unitId = UUID.randomUUID();
        setActor("technician");
        when(integrationService.updateUnitCadastre(unitId, " 12:34 "))
            .thenReturn("12:34");

        Map<String, Object> response = controller.updateUnitCadastre(
            unitId,
            new CadastreUpdateRequestDto(" 12:34 ")
        ).data();

        verify(integrationService).updateUnitCadastre(unitId, " 12:34 ");
        assertThat(response)
            .containsEntry("ok", true)
            .containsEntry("id", unitId)
            .containsEntry("cadastre", "12:34");
    }

    @Test
    void shouldRejectUpdateWithoutPolicy() {
        setActor("controller");

        assertThatThrownBy(() -> controller.updateUnitCadastre(UUID.randomUUID(), new CadastreUpdateRequestDto("1")))
            .isInstanceOf(ApiException.class)
            .hasMessage("Role cannot modify cadastre data");
    }

    private void setActor(String role) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", role, "bff"), null)
        );
    }
}
