package uz.reestrmkd.backendjpa.service;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtServiceTest {

    private final JwtService jwtService = new JwtService();

    @Test
    void verify_returns_payload_for_valid_token() {
        String token = jwtService.generate(Map.of("sub", "user-1", "role", "admin"), "secret", 60_000);

        Map<String, Object> payload = jwtService.verify(token, "secret");

        assertEquals("user-1", payload.get("sub"));
        assertEquals("admin", payload.get("role"));
    }

    @Test
    void verify_returns_token_signature_invalid_reason() {
        String token = jwtService.generate(Map.of("sub", "user-1", "role", "admin"), "secret", 60_000);

        RuntimeException ex = assertThrows(RuntimeException.class, () -> jwtService.verify(token, "wrong-secret"));

        assertEquals("TOKEN_SIGNATURE_INVALID", ex.getMessage());
    }

    @Test
    void verify_returns_token_format_invalid_reason() {
        RuntimeException ex = assertThrows(RuntimeException.class, () -> jwtService.verify("bad-token", "secret"));

        assertEquals("TOKEN_FORMAT_INVALID", ex.getMessage());
    }
}