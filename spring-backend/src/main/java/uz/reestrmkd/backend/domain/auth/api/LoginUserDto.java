package uz.reestrmkd.backend.domain.auth.api;

public record LoginUserDto(
    String id,
    String name,
    String role
) {}
