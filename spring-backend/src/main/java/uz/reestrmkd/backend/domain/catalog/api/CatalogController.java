package uz.reestrmkd.backend.domain.catalog.api;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.catalog.service.CatalogService;
import uz.reestrmkd.backend.domain.common.api.ItemsResponseDto;
import uz.reestrmkd.backend.domain.common.api.OkResponseDto;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.security.PolicyGuard;

@RestController
@RequestMapping("/api/v1/catalogs")
@PolicyGuard(domain = "catalogs", action = "read", message = "Role cannot read catalogs")
public class CatalogController {
    private final CatalogService catalogService;
    private final SecurityPolicyService securityPolicyService;

    public CatalogController(CatalogService catalogService, SecurityPolicyService securityPolicyService) {
        this.catalogService = catalogService;
        this.securityPolicyService = securityPolicyService;
    }

    @GetMapping("/{table}")
    public ItemsResponseDto getCatalog(@PathVariable String table, @RequestParam(required = false) String activeOnly) {
        return new ItemsResponseDto(catalogService.getCatalog(table, activeOnly));
    }

    @PostMapping("/{table}/upsert")
    @PolicyGuard(domain = "catalogs", action = "mutate", message = "Role cannot modify catalogs")
    public OkResponseDto upsert(@PathVariable String table, @Valid @RequestBody CatalogUpsertRequestDto body) {
        requirePolicy("catalogs", "mutate", "Role cannot modify catalogs");
        catalogService.upsert(table, body);
        return new OkResponseDto(true);
    }

    @PutMapping("/{table}/{id}/active")
    @PolicyGuard(domain = "catalogs", action = "mutate", message = "Role cannot modify catalogs")
    public ResponseEntity<OkResponseDto> setActive(@PathVariable String table, @PathVariable String id, @Valid @RequestBody CatalogActiveRequestDto body) {
        requirePolicy("catalogs", "mutate", "Role cannot modify catalogs");
        catalogService.setActive(table, id, body);
        return ResponseEntity.ok(new OkResponseDto(true));
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
