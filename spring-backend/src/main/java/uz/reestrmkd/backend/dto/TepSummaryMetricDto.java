package uz.reestrmkd.backend.dto;

import java.math.BigDecimal;

public record TepSummaryMetricDto(
    BigDecimal area,
    int count
) {
}
