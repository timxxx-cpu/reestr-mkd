package uz.reestrmkd.backend.domain.project.api;

import java.time.LocalDate;

import uz.reestrmkd.backend.domain.project.model.ProjectStatus;

public record ProjectPassportInfoDto(
    String name,
    String region,
    String district,
    String street,
    String regionSoato,
    String districtSoato,
    String streetId,
    String mahallaId,
    String mahalla,
    String buildingNo,
    String landmark,
    ProjectStatus status,
    LocalDate dateStartProject,
    LocalDate dateEndProject,
    LocalDate dateStartFact,
    LocalDate dateEndFact
) {
}
