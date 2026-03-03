package uz.reestrmkd.backendjpa.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

@Service
public class JwtService {
    private final ObjectMapper mapper = new ObjectMapper();

    public String generate(Map<String, Object> payload, String secret, long ttlMs) {
        try {
            long now = System.currentTimeMillis();
            Map<String, Object> p = new HashMap<>(payload);
            p.put("iat", now / 1000L);
            p.put("exp", (now + ttlMs) / 1000L);
            String h = enc(Map.of("alg", "HS256", "typ", "JWT"));
            String b = enc(p);
            return h + "." + b + "." + sign(h + "." + b, secret);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }



    public Map<String, Object> verify(String token, String secret) {
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) throw new IllegalArgumentException("Malformed token");
            String expected = sign(parts[0] + "." + parts[1], secret == null ? "" : secret);
            if (!expected.equals(parts[2])) throw new IllegalArgumentException("Bad signature");
            byte[] bodyBytes = Base64.getUrlDecoder().decode(parts[1]);
            Map<String, Object> payload = mapper.readValue(bodyBytes, Map.class);
            Object exp = payload.get("exp");
            long now = System.currentTimeMillis() / 1000L;
            if (exp instanceof Number n && n.longValue() < now) {
                throw new IllegalArgumentException("Token expired");
            }
            return payload;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private String enc(Map<String, Object> obj) throws Exception {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mapper.writeValueAsBytes(obj));
    }

    private String sign(String data, String secret) throws Exception {
        Mac hmac = Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hmac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
