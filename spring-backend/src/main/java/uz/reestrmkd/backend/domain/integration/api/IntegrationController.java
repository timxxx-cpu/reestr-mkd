package uz.reestrmkd.backend.domain.integration.api;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.common.api.MapResponseDto;
import uz.reestrmkd.backend.domain.integration.service.IntegrationService;
import uz.reestrmkd.backend.domain.registry.api.CadastreUpdateRequestDto;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.security.PolicyGuard;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@PolicyGuard(domain = "integration", action = "read", message = "Role cannot read integration data")
public class IntegrationController {
    private final IntegrationService integrationService;
    private final SecurityPolicyService securityPolicyService;

    public IntegrationController(
        IntegrationService integrationService,
        SecurityPolicyService securityPolicyService
    ) {
        this.integrationService = integrationService;
        this.securityPolicyService = securityPolicyService;
    }

    @GetMapping("/projects/{projectId}/integration-status")
    public MapResponseDto getStatus(@PathVariable UUID projectId) {
        return MapResponseDto.of(integrationService.getLatestIntegrationStatus(projectId));
    }

    @PutMapping("/projects/{projectId}/integration-status")
    @PolicyGuard(domain = "integration", action = "mutate", message = "Role cannot modify integration data")
    public MapResponseDto updateStatus(@PathVariable UUID projectId, @RequestBody(required = false) Map<String, Object> body) {
        requirePolicy("integration", "mutate", "Role cannot modify integration data");
        if (body == null) {
            throw new ApiException("Request body is required", "VALIDATION_ERROR", null, 400);
        }

        Map<String, Object> integrationData = integrationService.updateLatestIntegrationStatus(
            projectId,
            body.get("field") == null ? null : String.valueOf(body.get("field")),
            body.get("status")
        );
        return MapResponseDto.of(Map.of("ok", true, "integrationData", integrationData));
    }

    @PutMapping("/buildings/{buildingId}/cadastre")
    @PolicyGuard(domain = "integration", action = "mutate", message = "Role cannot modify cadastre data")
    public MapResponseDto updateBuildingCadastre(@PathVariable UUID buildingId, @RequestBody(required = false) CadastreUpdateRequestDto body) {
        requirePolicy("integration", "mutate", "Role cannot modify cadastre data");
        String cadastre = integrationService.updateBuildingCadastre(
            buildingId,
            body == null ? null : body.cadastre()
        );
        return MapResponseDto.of(Map.of("ok", true, "id", buildingId, "cadastre", cadastre));
    }

    @PutMapping("/units/{unitId}/cadastre")
    @PolicyGuard(domain = "integration", action = "mutate", message = "Role cannot modify cadastre data")
    public MapResponseDto updateUnitCadastre(@PathVariable UUID unitId, @RequestBody(required = false) CadastreUpdateRequestDto body) {
        requirePolicy("integration", "mutate", "Role cannot modify cadastre data");
        String cadastre = integrationService.updateUnitCadastre(
            unitId,
            body == null ? null : body.cadastre()
        );
        return MapResponseDto.of(Map.of("ok", true, "id", unitId, "cadastre", cadastre));
    }

    private void requirePolicy(String module, String action, String message) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ActorPrincipal actor)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRoleId(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}
