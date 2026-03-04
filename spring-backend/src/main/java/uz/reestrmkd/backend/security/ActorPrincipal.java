package uz.reestrmkd.backend.security;

public record ActorPrincipal(
    String userId,
    String userRole,
    String authType
) {
}
