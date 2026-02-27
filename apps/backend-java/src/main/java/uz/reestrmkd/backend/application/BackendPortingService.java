package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.common.ApiException;

import java.util.Map;

import static org.springframework.http.HttpStatus.NOT_IMPLEMENTED;

@Service
public class BackendPortingService {
    private final JdbcTemplate jdbcTemplate;

    public BackendPortingService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Map<String, Object> notImplemented(String endpointKey) {
        throw new ApiException(NOT_IMPLEMENTED, "NOT_IMPLEMENTED", "Endpoint port in progress: " + endpointKey);
    }

    public Map<String, Object> pingDatabase() {
        Integer one = jdbcTemplate.queryForObject("select 1", Integer.class);
        return Map.of("ok", one != null && one == 1);
    }
}
