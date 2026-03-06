package uz.reestrmkd.backend.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import uz.reestrmkd.backend.config.AppProperties;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class AuthContextFilter extends OncePerRequestFilter {

    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    public AuthContextFilter(AppProperties appProperties, ObjectMapper objectMapper) {
        this.appProperties = appProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        if (HttpMethod.OPTIONS.matches(request.getMethod()) || skipPath(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");
        String bearer = extractBearer(authHeader);

        if (bearer == null) {
            unauthorized(response, "Missing Bearer token");
            return;
        }

        if (appProperties.getJwtSecret().isBlank()) {
            unauthorized(response, "JWT_SECRET is not configured on the server");
            return;
        }

        ActorPrincipal actor = null;
        JwtVerification verification = parseJwtHs256(bearer, appProperties.getJwtSecret());
        if (verification.ok()) {
            actor = toActor(verification.payload(), "jwt");
        } else {
            unauthorized(response, "JWT auth failed: " + verification.reason());
            return;
        }

        if (actor == null) {
            unauthorized(response, "Unable to resolve auth context");
            return;
        }

        if (actor != null) {
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                actor,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + actor.userRole().toUpperCase(Locale.ROOT)))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }

    private boolean skipPath(String path) {
        if (path == null || !path.startsWith("/api/v1/")) {
            return true;
        }
        return "/api/v1/auth/login".equals(path);
    }

    private String extractBearer(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        return authHeader.substring("Bearer ".length()).trim();
    }

    private ActorPrincipal toActor(Map<String, Object> payload, String authType) {
        String userId = firstNonBlank(payload, "sub", "userId", "user_id");
        String userRole = firstNonBlank(payload, "role", "userRole", "user_role");
        if (userId == null || userRole == null) {
            return null;
        }
        return new ActorPrincipal(userId, userRole, authType);
    }

    private String firstNonBlank(Map<String, Object> payload, String... keys) {
        for (String key : keys) {
            Object value = payload.get(key);
            if (value != null) {
                String text = String.valueOf(value).trim();
                if (!text.isEmpty()) {
                    return text;
                }
            }
        }
        return null;
    }

    private JwtVerification parseJwtHs256(String token, String secret) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            return JwtVerification.error("TOKEN_FORMAT_INVALID");
        }

        try {
            JsonNode header = objectMapper.readTree(decodeBase64Url(parts[0]));
            JsonNode payload = objectMapper.readTree(decodeBase64Url(parts[1]));

            if (!"HS256".equals(header.path("alg").asText())) {
                return JwtVerification.error("TOKEN_ALG_UNSUPPORTED");
            }

            String expectedSignature = signHs256(parts[0], parts[1], secret);
            if (!MessageDigest.isEqual(parts[2].getBytes(StandardCharsets.UTF_8), expectedSignature.getBytes(StandardCharsets.UTF_8))) {
                return JwtVerification.error("TOKEN_SIGNATURE_INVALID");
            }

            long exp = payload.path("exp").asLong(0);
            if (exp > 0 && Instant.ofEpochSecond(exp).isBefore(Instant.now())) {
                return JwtVerification.error("TOKEN_EXPIRED");
            }

            @SuppressWarnings("unchecked")
            Map<String, Object> payloadMap = objectMapper.convertValue(payload, Map.class);
            return JwtVerification.ok(payloadMap);
        } catch (Exception ex) {
            return JwtVerification.error("TOKEN_DECODE_FAILED");
        }
    }

    private String decodeBase64Url(String value) {
        return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
    }

    private String signHs256(String header, String payload, String secret) throws Exception {
        String data = header + "." + payload;
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("code", "UNAUTHORIZED");
        payload.put("message", message);
        payload.put("details", null);
        objectMapper.writeValue(response.getWriter(), payload);
    }

    private record JwtVerification(boolean ok, String reason, Map<String, Object> payload) {
        private static JwtVerification ok(Map<String, Object> payload) {
            return new JwtVerification(true, null, payload);
        }

        private static JwtVerification error(String reason) {
            return new JwtVerification(false, reason, null);
        }
    }
}
