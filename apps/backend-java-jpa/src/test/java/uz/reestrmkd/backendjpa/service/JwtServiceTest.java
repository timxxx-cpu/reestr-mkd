package uz.reestrmkd.backendjpa.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    @Test
    void verify_returns_payload_for_valid_token() {
        JwtService jwt = new JwtService();
        String token = jwt.generate(Map.of("sub", "user-1", "role", "admin"), "secret", 60_000);

        Map<String, Object> payload = jwt.verify(token, "secret");

        assertEquals("user-1", payload.get("sub"));
        assertEquals("admin", payload.get("role"));
    }

    @Test
    void verify_throws_for_bad_signature() {
        JwtService jwt = new JwtService();
        String token = jwt.generate(Map.of("sub", "user-1"), "secret", 60_000);

        assertThrows(RuntimeException.class, () -> jwt.verify(token, "wrong-secret"));
    }
}
