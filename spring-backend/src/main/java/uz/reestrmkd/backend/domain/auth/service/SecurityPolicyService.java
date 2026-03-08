package uz.reestrmkd.backend.domain.auth.service;

import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.auth.model.UserRole;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class SecurityPolicyService {

    private static final Set<UserRole> ALL_ROLES = EnumSet.allOf(UserRole.class);

    private static final Map<String, Map<String, Set<UserRole>>> POLICY_MATRIX = Map.of(
        "workflow", Map.of(
            "read", ALL_ROLES,
            "mutate", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN, UserRole.CONTROLLER),
            "assignTechnician", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER),
            "requestDecline", EnumSet.of(UserRole.TECHNICIAN, UserRole.ADMIN, UserRole.BRANCH_MANAGER),
            "decline", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.CONTROLLER),
            "returnFromDecline", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER),
            "restore", EnumSet.of(UserRole.ADMIN)
        ),
        "projectInit", Map.of(
            "read", ALL_ROLES,
            "createFromApplication", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN)
        ),
        "composition", Map.of(
            "read", ALL_ROLES,
            "mutate", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN)
        ),
        "registry", Map.of(
            "read", ALL_ROLES,
            "mutate", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN)
        ),
        "integration", Map.of(
            "read", ALL_ROLES,
            "mutate", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN)
        ),
        "catalogs", Map.of(
            "read", ALL_ROLES,
            "mutate", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
        ),
        "projectExtended", Map.of(
            "read", ALL_ROLES,
            "mutate", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN),
            "deleteProject", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
        ),
        "validation", Map.of(
            "read", ALL_ROLES,
            "mutate", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN, UserRole.CONTROLLER)
        ),
        "versioning", Map.of(
            "read", ALL_ROLES,
            "mutate", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN, UserRole.CONTROLLER),
            "create", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.TECHNICIAN),
            "approve", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.CONTROLLER),
            "decline", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER, UserRole.CONTROLLER),
            "restore", EnumSet.of(UserRole.ADMIN, UserRole.BRANCH_MANAGER)
        ),
        "locks", Map.of(
            "read", ALL_ROLES,
            "mutate", ALL_ROLES
        )
    );

    public boolean allowByPolicy(Long actorRoleId, String domain, String action) {
        String effectiveAction = (action == null || action.isBlank()) ? "mutate" : action;
        UserRole role = UserRole.fromId(actorRoleId).orElse(null);
        if (role == null) {
            return false;
        }
        Set<UserRole> roles = POLICY_MATRIX.getOrDefault(domain, Map.of()).getOrDefault(effectiveAction, Set.of());
        return roles.contains(role);
    }

    public void requireAllowed(Long actorRoleId, String domain, String action) {
        requireAllowed(actorRoleId, domain, action, "Forbidden by policy");
    }

    public void requireAllowed(Long actorRoleId, String domain, String action, String message) {
        if (!allowByPolicy(actorRoleId, domain, action)) {
            throw new ApiException(message, "FORBIDDEN", Map.of("domain", domain, "action", action, "roleId", actorRoleId), 403);
        }
    }
}
