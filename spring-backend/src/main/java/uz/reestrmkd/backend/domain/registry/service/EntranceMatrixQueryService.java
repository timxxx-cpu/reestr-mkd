package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EntranceMatrixQueryService {

    private final JdbcTemplate jdbcTemplate;

    public EntranceMatrixQueryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> listByBlock(UUID blockId) {
        return jdbcTemplate.queryForList(
            "select * from entrance_matrix where block_id=? order by entrance_number",
            blockId
        );
    }
}
