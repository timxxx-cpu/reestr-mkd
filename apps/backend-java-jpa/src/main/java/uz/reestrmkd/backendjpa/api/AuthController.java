package uz.reestrmkd.backendjpa.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.AuthJpaService;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthJpaService auth;

    public AuthController(AuthJpaService auth) { this.auth = auth; }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody Map<String, Object> body) {
        return auth.login(String.valueOf(body.get("username")));
    }
}
