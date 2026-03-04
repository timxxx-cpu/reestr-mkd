package uz.reestrmkd.backend.dto;

import java.math.BigDecimal;

public record ProjectCadastreDataDto(
    String number,
    BigDecimal area
) {
}
