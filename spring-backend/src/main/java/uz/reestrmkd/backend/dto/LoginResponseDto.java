package uz.reestrmkd.backend.dto;

public record LoginResponseDto(
    boolean ok,
    String token,
    LoginUserDto user
) {}
