package uz.reestr.mkd.backendjpa.controller;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> credentials) {
        // Временная заглушка для разработки (dev mode)
        // Фронтенд ожидает объект с токеном или данными пользователя
        return ResponseEntity.ok(Map.of(
            "token", "dev-dummy-token",
            "user", Map.of(
                "id", "00000000-0000-0000-0000-000000000000",
                "email", credentials.getOrDefault("email", "dev@example.com"),
                "role", "admin"
            )
        ));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        return ResponseEntity.ok(Map.of("ok", true));
    }
}