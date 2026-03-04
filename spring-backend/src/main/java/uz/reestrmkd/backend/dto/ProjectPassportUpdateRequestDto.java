package uz.reestrmkd.backend.dto;

public record ProjectPassportUpdateRequestDto(
    ProjectPassportInfoDto info,
    ProjectCadastreDataDto cadastreData
) {
}
