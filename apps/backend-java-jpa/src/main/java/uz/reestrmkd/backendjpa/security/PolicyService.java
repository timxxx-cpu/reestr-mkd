package uz.reestrmkd.backendjpa.security;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backendjpa.api.error.ApiErrorException;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class PolicyService {

    private static final Map<String, Map<String, List<String>>> POLICY_MATRIX = Map.of(
        "workflow", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician", "controller"),
            "assignTechnician", List.of("admin", "branch_manager"),
            "requestDecline", List.of("technician", "admin", "branch_manager"),
            "decline", List.of("admin", "branch_manager", "controller"),
            "returnFromDecline", List.of("admin", "branch_manager"),
            "restore", List.of("admin")
        ),
        "catalogs", Map.of(
            "mutate", List.of("admin", "branch_manager")
        ),
        "versioning", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician", "controller"),
            "create", List.of("admin", "branch_manager", "technician"),
            "approve", List.of("admin", "branch_manager", "controller"),
            "decline", List.of("admin", "branch_manager", "controller"),
            "restore", List.of("admin", "branch_manager")
        )
    );

    public PolicyActor require(Authentication authentication, String module, String action, String forbiddenMessage) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ApiErrorException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Missing auth context");
        }

        String role = extractRole(authentication);
        if (role == null || role.isBlank()) {
            throw new ApiErrorException(HttpStatus.FORBIDDEN, "FORBIDDEN", "Policy actor role is required");
        }

        if (!allowByPolicy(role, module, action)) {
            throw new ApiErrorException(HttpStatus.FORBIDDEN, "FORBIDDEN", forbiddenMessage);
        }

        return new PolicyActor(authentication.getName(), role);
    }

    private boolean allowByPolicy(String actorRole, String module, String action) {
        var byModule = POLICY_MATRIX.get(module);
        if (byModule == null) return false;
        var roles = byModule.get(action);
        if (roles == null) return false;
        return roles.contains(actorRole);
    }

    private String extractRole(Authentication authentication) {
        if (authentication.getAuthorities() == null || authentication.getAuthorities().isEmpty()) {
            return null;
        }
        GrantedAuthority authority = authentication.getAuthorities().iterator().next();
        if (authority == null || authority.getAuthority() == null || authority.getAuthority().isBlank()) {
            return null;
        }
        String raw = authority.getAuthority();
        if (raw.startsWith("ROLE_")) raw = raw.substring(5);
        return raw.toLowerCase(Locale.ROOT);
    }

    public record PolicyActor(String userId, String userRole) {}
}

