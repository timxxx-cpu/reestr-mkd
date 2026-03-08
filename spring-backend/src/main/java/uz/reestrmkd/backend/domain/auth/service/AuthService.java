package uz.reestrmkd.backend.domain.auth.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.auth.api.LoginRequestDto;
import uz.reestrmkd.backend.domain.auth.api.LoginResponseDto;
import uz.reestrmkd.backend.domain.auth.api.LoginUserDto;
import uz.reestrmkd.backend.domain.auth.model.UserEntity;
import uz.reestrmkd.backend.domain.auth.model.UserRoleEntity;
import uz.reestrmkd.backend.domain.auth.repository.UserJpaRepository;
import uz.reestrmkd.backend.domain.auth.repository.UserRoleJpaRepository;
import uz.reestrmkd.backend.exception.ApiException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class AuthService {

    private final UserJpaRepository userJpaRepository;
    private final UserRoleJpaRepository userRoleJpaRepository;
    private final ObjectMapper objectMapper;
    private final String jwtSecret;

    public AuthService(
        UserJpaRepository userJpaRepository,
        UserRoleJpaRepository userRoleJpaRepository,
        ObjectMapper objectMapper,
        @Value("${app.jwt-secret:}") String jwtSecret
    ) {
        this.userJpaRepository = userJpaRepository;
        this.userRoleJpaRepository = userRoleJpaRepository;
        this.objectMapper = objectMapper;
        this.jwtSecret = jwtSecret;
    }

    public LoginResponseDto login(LoginRequestDto body) {
        UserEntity user = userJpaRepository.findFirstByUsernameAndPasswordAndStatusTrue(body.username(), body.password())
            .orElseThrow(() -> new ApiException("Invalid credentials", "UNAUTHORIZED", null, 401));

        UserRoleEntity roleEntity = userRoleJpaRepository.findFirstByUserId(user.getId())
            .orElseThrow(() -> new ApiException("User role is not assigned", "FORBIDDEN", null, 403));

        String role = normalizeRoleKey(roleEntity.getNameUk());
        if (role == null) {
            throw new ApiException("User role is not resolved", "FORBIDDEN", null, 403);
        }
        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new ApiException("JWT_SECRET is not configured on the server", "SERVER_ERROR", null, 500);
        }

        String displayName = pickFirstNonBlank(user.getFullName(), user.getUsername(), user.getId());
        String token = generateJwtHs256(Map.of("sub", user.getUsername(), "role", role, "name", displayName));
        return new LoginResponseDto(true, token, new LoginUserDto(user.getUsername(), displayName, role));
    }

    private String pickFirstNonBlank(Object... values) {
        for (Object value : values) {
            if (value == null) {
                continue;
            }
            String text = String.valueOf(value).trim();
            if (!text.isBlank()) {
                return text;
            }
        }
        return null;
    }

    private String normalizeRoleKey(String value) {
        if (value == null) {
            return null;
        }
        String role = value.trim().toLowerCase(Locale.ROOT);
        return role.isBlank() ? null : role;
    }

    private String generateJwtHs256(Map<String, Object> payload) {
        try {
            String header = base64Url(objectMapper.writeValueAsBytes(Map.of("alg", "HS256", "typ", "JWT")));
            long now = System.currentTimeMillis() / 1000;
            Map<String, Object> enriched = new LinkedHashMap<>(payload);
            enriched.put("exp", now + 24 * 60 * 60);
            enriched.put("iat", now);
            String body = base64Url(objectMapper.writeValueAsBytes(enriched));
            String signature = sign(header + "." + body);
            return header + "." + body + "." + signature;
        } catch (Exception ex) {
            throw new ApiException("Unable to generate token", "SERVER_ERROR", ex.getMessage(), 500);
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
