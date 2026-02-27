package uz.reestrmkd.backend.security;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.common.ApiException;

import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Service
public class PolicyService {
    private static final Map<String, Map<String, List<String>>> MATRIX = Map.of(
        "workflow", Map.of("mutate", List.of("admin", "branch_manager", "technician", "controller"),
            "assignTechnician", List.of("admin", "branch_manager"),
            "requestDecline", List.of("technician", "admin", "branch_manager"),
            "decline", List.of("admin", "branch_manager", "controller"),
            "returnFromDecline", List.of("admin", "branch_manager"),
            "restore", List.of("admin")),
        "projectInit", Map.of("createFromApplication", List.of("admin", "branch_manager", "technician")),
        "composition", Map.of("mutate", List.of("admin", "branch_manager", "technician")),
        "registry", Map.of("mutate", List.of("admin", "branch_manager", "technician")),
        "integration", Map.of("mutate", List.of("admin", "branch_manager", "technician")),
        "catalogs", Map.of("mutate", List.of("admin", "branch_manager")),
        "projectExtended", Map.of("mutate", List.of("admin", "branch_manager", "technician"), "deleteProject", List.of("admin", "branch_manager")),
        "validation", Map.of("mutate", List.of("admin", "branch_manager", "technician", "controller")),
        "versioning", Map.of("mutate", List.of("admin", "branch_manager", "technician", "controller"),
            "create", List.of("admin", "branch_manager", "technician"),
            "approve", List.of("admin", "branch_manager", "controller"),
            "decline", List.of("admin", "branch_manager", "controller"),
            "restore", List.of("admin", "branch_manager"))
    );

    public AuthContext require(String domain, String action, String message) {
        var actor = RequestContextHolder.get();
        if (actor == null || actor.userId() == null || actor.userId().isBlank()) {
            throw new ApiException(UNAUTHORIZED, "UNAUTHORIZED", "Missing auth context");
        }
        var allowed = MATRIX.getOrDefault(domain, Map.of()).getOrDefault(action, List.of());
        if (!allowed.contains(actor.userRole())) {
            throw new ApiException(FORBIDDEN, "FORBIDDEN", message);
        }
        return actor;
    }
}
