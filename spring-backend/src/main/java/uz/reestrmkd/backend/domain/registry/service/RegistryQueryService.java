package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RegistryQueryService {

    private final JdbcTemplate jdbcTemplate;
    private final FloorJpaRepository floorJpaRepository;

    public RegistryQueryService(JdbcTemplate jdbcTemplate, FloorJpaRepository floorJpaRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.floorJpaRepository = floorJpaRepository;
    }

    public List<Map<String, Object>> loadBuildingsSummary(String search, Integer page, Integer limit) {
        StringBuilder sql = new StringBuilder("select * from view_registry_buildings_summary where 1=1");
        List<Object> args = new ArrayList<>();

        if (search != null && !search.isBlank()) {
            sql.append(" and (coalesce(project_name,'') ilike ? or coalesce(building_name,'') ilike ? or coalesce(block_label,'') ilike ?)");
            String like = "%" + search + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }

        int safeLimit = limit == null || limit <= 0 ? 50 : Math.min(limit, 200);
        int safePage = page == null || page <= 0 ? 1 : page;
        int offset = (safePage - 1) * safeLimit;

        sql.append(" order by project_name asc limit ? offset ?");
        args.add(safeLimit);
        args.add(offset);
        return jdbcTemplate.queryForList(Objects.requireNonNull(sql.toString()), args.toArray());
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