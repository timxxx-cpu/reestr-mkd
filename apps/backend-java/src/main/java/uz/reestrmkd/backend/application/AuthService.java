package uz.reestrmkd.backend.application;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.common.ApiException;
import uz.reestrmkd.backend.config.AppProperties;
import uz.reestrmkd.backend.security.JwtHs256Service;

import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.*;

@Service
public class AuthService {
    private final JdbcTemplate jdbc;
    private final AppProperties props;
    private final JwtHs256Service jwt;

    public AuthService(JdbcTemplate jdbc, AppProperties props, JwtHs256Service jwt) {
        this.jdbc = jdbc;
        this.props = props;
        this.jwt = jwt;
    }

    public Map<String, Object> login(String username) {
        if (username == null || username.isBlank()) {
            throw new ApiException(BAD_REQUEST, "VALIDATION_ERROR", "Username is required");
        }

        List<Map<String, Object>> rows = jdbc.query(
            "select code, name, role, is_active from dict_system_users where code = ?",
            (rs, n) -> Map.of(
                "code", rs.getString("code"),
                "name", rs.getString("name"),
                "role", rs.getString("role"),
                "is_active", rs.getBoolean("is_active")
            ), username
        );

        if (rows.isEmpty()) throw new ApiException(UNAUTHORIZED, "UNAUTHORIZED", "Invalid credentials");
        Map<String, Object> user = rows.get(0);

        if (!Boolean.TRUE.equals(user.get("is_active"))) {
            throw new ApiException(FORBIDDEN, "FORBIDDEN", "User account is disabled");
        }

        if (props.getJwtSecret() == null || props.getJwtSecret().isBlank()) {
            throw new ApiException(INTERNAL_SERVER_ERROR, "SERVER_ERROR", "JWT_SECRET is not configured on the server");
        }

        String token = jwt.generate(Map.of(
            "sub", String.valueOf(user.get("code")),
            "role", String.valueOf(user.get("role")),
            "name", String.valueOf(user.get("name"))
        ), props.getJwtSecret(), 24 * 60 * 60 * 1000L);

        return Map.of(
            "ok", true,
            "token", token,
            "user", Map.of(
                "id", String.valueOf(user.get("code")),
                "name", String.valueOf(user.get("name")),
                "role", String.valueOf(user.get("role"))
            )
        );
    }
}
