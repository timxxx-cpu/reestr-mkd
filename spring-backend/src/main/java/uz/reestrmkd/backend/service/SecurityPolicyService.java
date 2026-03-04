package uz.reestrmkd.backend.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.List;
import java.util.Map;

@Service
public class SecurityPolicyService {

    private static final Map<String, Map<String, List<String>>> POLICY_MATRIX = Map.of(
        "workflow", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician", "controller"),
            "assignTechnician", List.of("admin", "branch_manager"),
            "requestDecline", List.of("technician", "admin", "branch_manager"),
            "decline", List.of("admin", "branch_manager", "controller"),
            "returnFromDecline", List.of("admin", "branch_manager"),
            "restore", List.of("admin")
        ),
        "projectInit", Map.of(
            "createFromApplication", List.of("admin", "branch_manager", "technician")
        ),
        "composition", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician")
        ),
        "registry", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician")
        ),
        "integration", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician")
        ),
        "catalogs", Map.of(
            "mutate", List.of("admin", "branch_manager")
        ),
        "projectExtended", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician"),
            "deleteProject", List.of("admin", "branch_manager")
        ),
        "validation", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician", "controller")
        ),
        "versioning", Map.of(
            "mutate", List.of("admin", "branch_manager", "technician", "controller"),
            "create", List.of("admin", "branch_manager", "technician"),
            "approve", List.of("admin", "branch_manager", "controller"),
            "decline", List.of("admin", "branch_manager", "controller"),
            "restore", List.of("admin", "branch_manager")
        )
    );

    public boolean allowByPolicy(String actorRole, String domain, String action) {
        String effectiveAction = (action == null || action.isBlank()) ? "mutate" : action;
        List<String> roles = POLICY_MATRIX.getOrDefault(domain, Map.of()).getOrDefault(effectiveAction, List.of());
        return roles.contains(actorRole);
    }

    public void requireAllowed(String actorRole, String domain, String action) {
        if (!allowByPolicy(actorRole, domain, action)) {
            throw new ApiException("Forbidden by policy", "FORBIDDEN", Map.of("domain", domain, "action", action), 403);
        }
    }
}
