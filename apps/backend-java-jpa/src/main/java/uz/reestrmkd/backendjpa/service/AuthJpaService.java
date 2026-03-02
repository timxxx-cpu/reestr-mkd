package uz.reestrmkd.backendjpa.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
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
        // Ищем по code, а не по id. Если не найдено - кидаем 401 Unauthorized
        var user = users.findByCode(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Пользователь не найден"));
                
        // Если отключен - кидаем 403 Forbidden
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Пользователь заблокирован");
        }
        
        String token = jwt.generate(Map.of("sub", user.getCode(), "role", user.getRole()), jwtSecret, 24 * 60 * 60 * 1000L);
        return Map.of("ok", true, "token", token, "user", Map.of("id", user.getCode(), "name", user.getName(), "role", user.getRole()));
    }
}