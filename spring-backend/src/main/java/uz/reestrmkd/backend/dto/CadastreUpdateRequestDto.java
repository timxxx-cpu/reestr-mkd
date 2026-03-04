package uz.reestrmkd.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record CadastreUpdateRequestDto(
    @NotBlank(message = "cadastre is required")
    String cadastre
) {}
