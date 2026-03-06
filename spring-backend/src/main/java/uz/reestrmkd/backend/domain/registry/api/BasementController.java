package uz.reestrmkd.backend.domain.registry.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.common.api.MapResponseDto;
import uz.reestrmkd.backend.domain.registry.service.BasementService;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.security.CurrentUser;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class BasementController {
    private final BasementService basementService;
    private final SecurityPolicyService securityPolicyService;

    public BasementController(BasementService basementService, SecurityPolicyService securityPolicyService) {
        this.basementService = basementService;
        this.securityPolicyService = securityPolicyService;
    }

    @GetMapping("/projects/{projectId}/basements")
    public List<Map<String, Object>> getProjectBasements(@PathVariable UUID projectId) {
        return basementService.getProjectBasements(projectId);
    }

    @GetMapping("/basements")
    public List<Map<String, Object>> getBasementsByBuildingIds(@RequestParam(required = false) String buildingIds) {
        if (buildingIds == null || buildingIds.isBlank()) {
            return List.of();
        }
        List<UUID> ids = new ArrayList<>();
        for (String raw : Arrays.stream(buildingIds.split(",")).map(String::trim).filter(value -> !value.isBlank()).toList()) {
            try {
                ids.add(UUID.fromString(raw));
            } catch (IllegalArgumentException ex) {
                throw new ApiException("buildingIds contains invalid UUID: " + raw, "VALIDATION_ERROR", null, 400);
            }
        }
        return basementService.getBasementsByBuildingIds(ids);
    }

    @PutMapping("/basements/{basementId}/parking-levels/{level}")
    public MapResponseDto toggleBasementLevel(
        @PathVariable UUID basementId,
        @PathVariable int level,
        @RequestBody(required = false) BasementParkingLevelToggleRequestDto payload,
        @CurrentUser ActorPrincipal actor // <-- Внедряем пользователя
    ) {
        requirePolicy(actor, "projectExtended", "mutate", "Role cannot modify basement levels");
        boolean isEnabled = payload != null && Boolean.TRUE.equals(payload.isEnabled());
        basementService.toggleBasementLevel(basementId, level, isEnabled);
        return MapResponseDto.of(Map.of("ok", true));
    }

    // Хелпер теперь принимает пользователя напрямую
    private void requirePolicy(ActorPrincipal actor, String module, String action, String message) {
        if (actor == null) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRole(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}