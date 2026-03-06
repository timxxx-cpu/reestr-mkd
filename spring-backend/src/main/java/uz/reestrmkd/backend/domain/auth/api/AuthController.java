package uz.reestrmkd.backend.domain.auth.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import uz.reestrmkd.backend.exception.ApiException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final String jwtSecret;

    public AuthController(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper, @Value("${app.jwt-secret:}") String jwtSecret) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.jwtSecret = jwtSecret;
    }

   @PostMapping("/login")
    public ResponseEntity<LoginResponseDto> login(@Valid @RequestBody LoginRequestDto body) {
        String login = body.username();
        String password = body.password();

        var users = jdbcTemplate.queryForList(
            """
                select id, username, password, full_name, status
                from general.users
                where username = ? and password = ? and status = true
                limit 1
                """,
            login,
            password
        );
        if (users.isEmpty()) throw new ApiException("Invalid credentials", "UNAUTHORIZED", null, 401);

        Map<String, Object> user = users.getFirst();
        Object dbId = user.get("id");             // Числовой ID для базы данных
        Object username = user.get("username");   // Логин (username) для системы и связей

        var roles = jdbcTemplate.queryForList(
            """
                select ur.name_uk
                from general.user_attached_roles uar
                join general.user_roles ur on ur.id = uar.user_roles_id
                where uar.users_id = ?
                limit 1
                """,
            dbId // Ищем роль по числовому ID
        );
        if (roles.isEmpty()) throw new ApiException("User role is not assigned", "FORBIDDEN", null, 403);

        String role = normalizeRoleKey(roles.getFirst().get("name_uk"));
        if (role == null) throw new ApiException("User role is not resolved", "FORBIDDEN", null, 403);

        String displayName = pickFirstNonBlank(user.get("full_name"), user.get("username"), user.get("id"));
        if (jwtSecret == null || jwtSecret.isBlank()) throw new ApiException("JWT_SECRET is not configured on the server", "SERVER_ERROR", null, 500);

        // Генерируем токен, используя логин (username) в качестве ID пользователя
        String token = generateJwtHs256(Map.of("sub", String.valueOf(username), "role", role, "name", displayName));
        LoginResponseDto response = new LoginResponseDto(
            true,
            token,
            new LoginUserDto(String.valueOf(username), displayName, role) // Отдаем фронтенду логин как ID
        );
        return ResponseEntity.ok(response);
    }

    private String pickFirstNonBlank(Object... values) {
        for (Object value : values) {
            if (value == null) continue;
            String text = String.valueOf(value).trim();
            if (!text.isBlank()) return text;
        }
        return null;
    }

    private String normalizeRoleKey(Object value) {
        if (value == null) return null;
        String role = String.valueOf(value).trim().toLowerCase(Locale.ROOT);
        return role.isBlank() ? null : role;
    }

    private String generateJwtHs256(Map<String, Object> payload) {
        try {
            String header = base64Url(objectMapper.writeValueAsBytes(Map.of("alg", "HS256", "typ", "JWT")));
            long now = System.currentTimeMillis() / 1000;
            Map<String, Object> enriched = new LinkedHashMap<>(payload);
            enriched.put("exp", now + 24 * 60 * 60);
            enriched.put("iat", now);
            String pl = base64Url(objectMapper.writeValueAsBytes(enriched));
            String sig = sign(header + "." + pl);
            return header + "." + pl + "." + sig;
        } catch (Exception e) {
            throw new ApiException("Unable to generate token", "SERVER_ERROR", e.getMessage(), 500);
        }
    }

    private String sign(String data) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }

    private String base64Url(byte[] data) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(data);
    }
}
