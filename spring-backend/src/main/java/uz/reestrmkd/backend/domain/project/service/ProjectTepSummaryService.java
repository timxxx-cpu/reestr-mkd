package uz.reestrmkd.backend.domain.project.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.api.TepSummaryMetricDto;
import uz.reestrmkd.backend.domain.registry.api.TepSummaryMopDto;
import uz.reestrmkd.backend.domain.registry.api.TepSummaryResponseDto;
import uz.reestrmkd.backend.domain.registry.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;

@Service
public class ProjectTepSummaryService {

    private final FloorJpaRepository floorJpaRepository;
    private final UnitJpaRepository unitJpaRepository;
    private final CommonAreaJpaRepository commonAreaJpaRepository;
    private final BuildingJpaRepository buildingJpaRepository;

    public ProjectTepSummaryService(
        FloorJpaRepository floorJpaRepository,
        UnitJpaRepository unitJpaRepository,
        CommonAreaJpaRepository commonAreaJpaRepository,
        BuildingJpaRepository buildingJpaRepository
    ) {
        this.floorJpaRepository = floorJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
        this.commonAreaJpaRepository = commonAreaJpaRepository;
        this.buildingJpaRepository = buildingJpaRepository;
    }

    @Transactional(readOnly = true)
    public TepSummaryResponseDto getTepSummary(UUID projectId) {
        BigDecimal totalAreaProj = normalizeScale(floorJpaRepository.sumAreaProjByProjectId(projectId));
        BigDecimal totalAreaFact = normalizeScale(floorJpaRepository.sumAreaFactByProjectId(projectId));

        BigDecimal livingArea = BigDecimal.ZERO;
        int livingCount = 0;
        BigDecimal commercialArea = BigDecimal.ZERO;
        int commercialCount = 0;
        BigDecimal infrastructureArea = BigDecimal.ZERO;
        int infrastructureCount = 0;
        BigDecimal parkingArea = BigDecimal.ZERO;
        int parkingCount = 0;
        int cadastreReadyCount = 0;

        var units = unitJpaRepository.findTepUnitRowsByProjectId(projectId);
        for (UnitJpaRepository.TepUnitRow unit : units) {
            String unitType = unit.getUnitType() == null ? "" : unit.getUnitType().trim();
            BigDecimal area = toBigDecimal(unit.getTotalArea());
            if (unit.getCadastreNumber() != null && !unit.getCadastreNumber().isBlank()) {
                cadastreReadyCount += 1;
            }

            if (isLivingType(unitType)) {
                livingArea = livingArea.add(area);
                livingCount += 1;
            } else if (isCommercialType(unitType)) {
                commercialArea = commercialArea.add(area);
                commercialCount += 1;
            } else if (isParkingType(unitType)) {
                parkingArea = parkingArea.add(area);
                parkingCount += 1;
            } else {
                infrastructureArea = infrastructureArea.add(area);
                infrastructureCount += 1;
            }
        }

        BigDecimal mopArea = normalizeScale(commonAreaJpaRepository.sumAreaByProjectId(projectId));
        var buildings = buildingJpaRepository.findTimelineRowsByProjectId(projectId);
        BigDecimal progressSum = BigDecimal.ZERO;
        for (BuildingJpaRepository.BuildingTimelineRow building : buildings) {
            progressSum = progressSum.add(calcProgress(building.getDateStart(), building.getDateEnd()));
        }
        BigDecimal avgProgress = buildings.isEmpty()
            ? BigDecimal.ZERO
            : progressSum.divide(BigDecimal.valueOf(buildings.size()), 2, RoundingMode.HALF_UP);

        return new TepSummaryResponseDto(
            totalAreaProj,
            totalAreaFact,
            new TepSummaryMetricDto(normalizeScale(livingArea), livingCount),
            new TepSummaryMetricDto(normalizeScale(commercialArea), commercialCount),
            new TepSummaryMetricDto(normalizeScale(infrastructureArea), infrastructureCount),
            new TepSummaryMetricDto(normalizeScale(parkingArea), parkingCount),
            new TepSummaryMopDto(mopArea),
            cadastreReadyCount,
            units.size(),
            normalizeScale(avgProgress)
        );
    }

    private boolean isLivingType(String type) {
        return Set.of("flat", "duplex_up", "duplex_down").contains(type);
    }

    private boolean isCommercialType(String type) {
        return Set.of("office", "office_inventory", "non_res_block").contains(type);
    }

    private boolean isParkingType(String type) {
        return "parking_place".equals(type);
    }

    private BigDecimal toBigDecimal(Object value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        if (value instanceof BigDecimal bigDecimal) {
            return bigDecimal;
        }
        if (value instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue());
        }
        try {
            return new BigDecimal(String.valueOf(value));
        } catch (Exception ignored) {
            return BigDecimal.ZERO;
        }
    }

    private BigDecimal normalizeScale(BigDecimal value) {
        BigDecimal raw = value == null ? BigDecimal.ZERO : value;
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal calcProgress(LocalDate dateStart, LocalDate dateEnd) {
        Instant start = toInstant(dateStart);
        if (start == null || Instant.EPOCH.equals(start)) {
            return BigDecimal.ZERO;
        }
        Instant end = toInstant(dateEnd);
        if (end != null && !end.isBefore(start)) {
            return BigDecimal.valueOf(100);
        }

        long totalDays = 365;
        long elapsedDays = Math.max(0, (Instant.now().toEpochMilli() - start.toEpochMilli()) / (1000L * 60L * 60L * 24L));
        BigDecimal progress = BigDecimal.valueOf(elapsedDays)
            .multiply(BigDecimal.valueOf(100))
            .divide(BigDecimal.valueOf(totalDays), 2, RoundingMode.HALF_UP);
        if (progress.compareTo(BigDecimal.valueOf(100)) > 0) {
            return BigDecimal.valueOf(100);
        }
        if (progress.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO;
        }
        return progress;
    }

    private Instant toInstant(LocalDate localDate) {
        return localDate == null ? Instant.EPOCH : localDate.atStartOfDay().toInstant(ZoneOffset.UTC);
    }
}
