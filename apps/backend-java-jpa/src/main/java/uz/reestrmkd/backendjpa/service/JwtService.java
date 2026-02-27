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

    private String enc(Map<String, Object> obj) throws Exception {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(mapper.writeValueAsBytes(obj));
    }

    private String sign(String data, String secret) throws Exception {
        Mac hmac = Mac.getInstance("HmacSHA256");
        hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return Base64.getUrlEncoder().withoutPadding().encodeToString(hmac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
    }
}
