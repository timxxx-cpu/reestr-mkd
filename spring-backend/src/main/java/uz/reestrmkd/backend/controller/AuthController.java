package uz.reestrmkd.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestrmkd.backend.dto.LoginRequestDto;
import uz.reestrmkd.backend.dto.LoginResponseDto;
import uz.reestrmkd.backend.dto.LoginUserDto;
import uz.reestrmkd.backend.exception.ApiException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
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
        String username = body.username();

        var rows = jdbcTemplate.queryForList("select code, name, role, is_active from dict_system_users where code = ?", username);
        if (rows.isEmpty()) throw new ApiException("Invalid credentials", "UNAUTHORIZED", null, 401);
        Map<String, Object> user = rows.getFirst();
        if (!Boolean.TRUE.equals(user.get("is_active"))) throw new ApiException("User account is disabled", "FORBIDDEN", null, 403);
        if (jwtSecret == null || jwtSecret.isBlank()) throw new ApiException("JWT_SECRET is not configured on the server", "SERVER_ERROR", null, 500);

        String token = generateJwtHs256(Map.of("sub", user.get("code"), "role", user.get("role"), "name", user.get("name")));
        LoginResponseDto response = new LoginResponseDto(
            true,
            token,
            new LoginUserDto(String.valueOf(user.get("code")), String.valueOf(user.get("name")), String.valueOf(user.get("role")))
        );
        return ResponseEntity.ok(response);
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
