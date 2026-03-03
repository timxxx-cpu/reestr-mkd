package uz.reestrmkd.backendjpa.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
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
        String[] parts = String.valueOf(token).split("\\.");
        if (parts.length != 3) throw new RuntimeException("TOKEN_FORMAT_INVALID");

        String headerJson;
        String payloadJson;
        try {
            headerJson = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8);
            payloadJson = new String(Base64.getUrlDecoder().decode(parts[1]), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("TOKEN_DECODE_FAILED");
        }

        Map<String, Object> header;
        Map<String, Object> payload;
        try {
            header = mapper.readValue(headerJson, Map.class);
            payload = mapper.readValue(payloadJson, Map.class);
            } catch (Exception e) {
                throw new RuntimeException("TOKEN_DECODE_FAILED");
        }

        if (!"HS256".equals(String.valueOf(header.get("alg")))) {
            throw new RuntimeException("TOKEN_ALG_UNSUPPORTED");
        }

        String expected;
        try {
            expected = sign(parts[0] + "." + parts[1], secret == null ? "" : secret);
        } catch (Exception e) {
            throw new RuntimeException("TOKEN_SIGNATURE_INVALID");
        }

        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), parts[2].getBytes(StandardCharsets.UTF_8))) {
            throw new RuntimeException("TOKEN_SIGNATURE_INVALID");
        }

        Object exp = payload.get("exp");
        long now = System.currentTimeMillis() / 1000L;
        if (exp instanceof Number n && n.longValue() <= now) {
            throw new RuntimeException("TOKEN_EXPIRED");
        }

        return payload; 
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
