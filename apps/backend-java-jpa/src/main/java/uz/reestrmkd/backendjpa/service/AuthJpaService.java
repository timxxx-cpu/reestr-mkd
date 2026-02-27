package uz.reestrmkd.backendjpa.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backendjpa.repo.SystemUserRepository;

import java.util.Map;

@Service
public class AuthJpaService {
    private final SystemUserRepository users;
    private final JwtService jwt;
    @Value("${app.jwt-secret:}")
    private String jwtSecret;

    public AuthJpaService(SystemUserRepository users, JwtService jwt) {
        this.users = users;
        this.jwt = jwt;
    }

    public Map<String, Object> login(String username) {
        var user = users.findById(username).orElseThrow();
        if (!Boolean.TRUE.equals(user.getIsActive())) throw new IllegalStateException("User disabled");
        String token = jwt.generate(Map.of("sub", user.getCode(), "role", user.getRole()), jwtSecret, 24 * 60 * 60 * 1000L);
        return Map.of("ok", true, "token", token, "user", Map.of("id", user.getCode(), "name", user.getName(), "role", user.getRole()));
    }
}
