package uz.reestrmkd.backend.dto;

import java.math.BigDecimal;

public record TepSummaryResponseDto(
    BigDecimal totalAreaProj,
    BigDecimal totalAreaFact,
    TepSummaryMetricDto living,
    TepSummaryMetricDto commercial,
    TepSummaryMetricDto infrastructure,
    TepSummaryMetricDto parking,
    TepSummaryMopDto mop,
    int cadastreReadyCount,
    int totalObjectsCount,
    BigDecimal avgProgress
) {
}
