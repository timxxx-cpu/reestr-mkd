package uz.reestrmkd.backend.domain.auth.api;

public record LoginResponseDto(
    boolean ok,
    String token,
    LoginUserDto user
) {}
