package uz.reestrmkd.backend.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtHs256Service {
    private final ObjectMapper mapper = new ObjectMapper();

    public Map<String, Object> verify(String token, String secret) {
        try {
            var parts = token.split("\\.");
            if (parts.length != 3) return null;
            var header = parseB64(parts[0]);
            if (!"HS256".equals(String.valueOf(header.get("alg")))) return null;

            String expected = sign(parts[0] + "." + parts[1], secret);
            if (!expected.equals(parts[2])) return null;

            var payload = parseB64(parts[1]);
            var exp = payload.get("exp");
            if (exp instanceof Number number) {
                if (number.longValue() * 1000L <= System.currentTimeMillis()) return null;
            }
            return payload;
        } catch (Exception ignored) {
            return null;
        }
    }

    public String generate(Map<String, Object> payload, String secret, long expiresInMs) {
        try {
            long now = System.currentTimeMillis();
            Map<String, Object> body = new HashMap<>(payload);
            body.put("iat", now / 1000L);
            body.put("exp", (now + expiresInMs) / 1000L);

            String headerB64 = encodeB64(Map.of("alg", "HS256", "typ", "JWT"));
            String payloadB64 = encodeB64(body);
            String sign = sign(headerB64 + "." + payloadB64, secret);
            return headerB64 + "." + payloadB64 + "." + sign;
        } catch (Exception e) {
            throw new IllegalStateException("Unable to generate JWT", e);
        }
    }

    private Map<String, Object> parseB64(String raw) throws Exception {
        String normalized = raw.replace('-', '+').replace('_', '/');
        int padding = normalized.length() % 4;
        if (padding > 0) normalized += "=".repeat(4 - padding);
        String json = new String(Base64.getDecoder().decode(normalized), StandardCharsets.UTF_8);
        return mapper.readValue(json, Map.class);
    }

    private String encodeB64(Map<String, Object> obj) throws Exception {
        String json = mapper.writeValueAsString(obj);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }

    private String sign(String data, String secret) throws Exception {
        Mac hmac = Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest);
    }
}
