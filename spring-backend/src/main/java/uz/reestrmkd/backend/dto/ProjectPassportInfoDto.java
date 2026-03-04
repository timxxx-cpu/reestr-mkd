package uz.reestrmkd.backend.dto;

import uz.reestrmkd.backend.enums.ProjectStatus;

import java.time.LocalDate;

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
