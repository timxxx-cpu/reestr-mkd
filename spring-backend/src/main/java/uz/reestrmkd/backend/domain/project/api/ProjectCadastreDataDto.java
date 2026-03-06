package uz.reestrmkd.backend.domain.project.api;

import java.math.BigDecimal;

public record ProjectCadastreDataDto(
    String number,
    BigDecimal area
) {
}
