package uz.reestrmkd.backend.security;

public record ActorPrincipal(
    String userId,
    Long roleId,
    String roleKey,
    String authType
) {
    public ActorPrincipal(String userId, String userRole, String authType) {
        this(
            userId,
            uz.reestrmkd.backend.domain.auth.model.UserRole.fromKey(userRole).map(uz.reestrmkd.backend.domain.auth.model.UserRole::id).orElse(null),
            uz.reestrmkd.backend.domain.auth.model.UserRole.fromKey(userRole).map(uz.reestrmkd.backend.domain.auth.model.UserRole::key).orElse(userRole),
            authType
        );
    }

    public Long userRoleId() {
        return roleId;
    }

    public String userRole() {
        return roleKey;
    }

    public uz.reestrmkd.backend.domain.auth.model.UserRole role() {
        return uz.reestrmkd.backend.domain.auth.model.UserRole.fromId(roleId)
            .or(() -> uz.reestrmkd.backend.domain.auth.model.UserRole.fromKey(roleKey))
            .orElse(null);
    }
}
