package uz.reestrmkd.backend.domain.registry.api;

import java.math.BigDecimal;

public record TepSummaryMetricDto(
    BigDecimal area,
    int count
) {
}
