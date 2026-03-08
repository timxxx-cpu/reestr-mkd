package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.RegistryBuildingSummaryRepository;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RegistryQueryService {

    private final RegistryBuildingSummaryRepository registryBuildingSummaryRepository;
    private final FloorJpaRepository floorJpaRepository;

    public RegistryQueryService(
        RegistryBuildingSummaryRepository registryBuildingSummaryRepository,
        FloorJpaRepository floorJpaRepository
    ) {
        this.registryBuildingSummaryRepository = registryBuildingSummaryRepository;
        this.floorJpaRepository = floorJpaRepository;
    }

    public List<Map<String, Object>> loadBuildingsSummary(String search, Integer page, Integer limit) {
        int safeLimit = limit == null || limit <= 0 ? 50 : Math.min(limit, 200);
        int safePage = page == null || page <= 0 ? 1 : page;

        return registryBuildingSummaryRepository.findSummary(
            search == null || search.isBlank() ? null : search.trim(),
            PageRequest.of(safePage - 1, safeLimit)
        ).stream().map(row -> {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("building_id", row.getBuildingId());
            result.put("project_name", row.getProjectName());
            result.put("building_name", row.getBuildingName());
            result.put("block_label", row.getBlockLabel());
            result.put("building_code", row.getBuildingCode());
            result.put("house_number", row.getHouseNumber());
            result.put("category", row.getCategory());
            result.put("floors_count", row.getFloorsCount());
            result.put("count_living", row.getCountLiving());
            result.put("area_living_total", row.getAreaLivingTotal());
            result.put("count_commercial", row.getCountCommercial());
            result.put("area_commercial", row.getAreaCommercial());
            result.put("count_parking", row.getCountParking());
            result.put("area_parking", row.getAreaParking());
            result.put("area_total_sum", row.getAreaTotalSum());
            return result;
        }).toList();
    }

    public Map<String, Integer> loadParkingCounts(UUID projectId) {
        return floorJpaRepository.countParkingPlacesByProjectId(projectId).stream()
            .collect(Collectors.toUnmodifiableMap(
                row -> row.getFloorId().toString(),
                row -> row.getParkingCount().intValue(),
                (left, right) -> right
            ));
    }
}
