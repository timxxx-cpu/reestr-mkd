package uz.reestrmkd.backend.domain.registry.api;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.common.api.MapResponseDto;
import uz.reestrmkd.backend.domain.registry.service.CompositionBuildingService;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.security.PolicyGuard;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@PolicyGuard(domain = "composition", action = "read", message = "Role cannot read composition")
public class CompositionController {

    private final SecurityPolicyService securityPolicyService;
    private final CompositionBuildingService compositionBuildingService;

    public CompositionController(
        SecurityPolicyService securityPolicyService,
        CompositionBuildingService compositionBuildingService
    ) {
        this.securityPolicyService = securityPolicyService;
        this.compositionBuildingService = compositionBuildingService;
    }

    @GetMapping("/projects/{projectId}/buildings")
    public List<Map<String, Object>> getBuildings(@PathVariable UUID projectId) {
        return compositionBuildingService.loadBuildings(projectId);
    }

    @PostMapping("/projects/{projectId}/buildings")
    @Transactional
    @PolicyGuard(domain = "composition", action = "mutate", message = "Role cannot modify composition")
    public MapResponseDto create(@PathVariable UUID projectId, @RequestBody(required = false) Map<String, Object> body) {
        requirePolicy("composition", "mutate", "Role cannot modify composition");
        Map<String, Object> buildingData = asMap(body == null ? null : body.get("buildingData"));
        List<Map<String, Object>> blocksData = asList(body == null ? null : body.get("blocksData"));
        return MapResponseDto.of(compositionBuildingService.createBuilding(projectId, buildingData, blocksData));
    }

    @PutMapping("/buildings/{buildingId}")
    @Transactional
    @PolicyGuard(domain = "composition", action = "mutate", message = "Role cannot modify composition")
    public MapResponseDto update(@PathVariable UUID buildingId, @RequestBody(required = false) Map<String, Object> body) {
        requirePolicy("composition", "mutate", "Role cannot modify composition");
        Map<String, Object> buildingData = asMap(body == null ? null : body.get("buildingData"));
        List<Map<String, Object>> blocksData = body != null && body.get("blocksData") != null ? asList(body.get("blocksData")) : null;
        return MapResponseDto.of(compositionBuildingService.updateBuilding(buildingId, buildingData, blocksData));
    }

    @DeleteMapping("/buildings/{buildingId}")
    @Transactional
    @PolicyGuard(domain = "composition", action = "mutate", message = "Role cannot modify composition")
    public MapResponseDto delete(@PathVariable UUID buildingId) {
        requirePolicy("composition", "mutate", "Role cannot modify composition");
        return MapResponseDto.of(compositionBuildingService.deleteBuilding(buildingId));
    }

    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) {
            Map<String, Object> result = new LinkedHashMap<>();
            map.forEach((k, v) -> result.put(String.valueOf(k), v));
            return result;
        }
        return Map.of();
    }

    private List<Map<String, Object>> asList(Object value) {
        if (value instanceof List<?> list) {
            return list.stream().map(this::asMap).toList();
        }
        return List.of();
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
