package uz.reestrmkd.backend.domain.project.api;

public record ProjectPassportUpdateRequestDto(
    ProjectPassportInfoDto info,
    ProjectCadastreDataDto cadastreData
) {
}
