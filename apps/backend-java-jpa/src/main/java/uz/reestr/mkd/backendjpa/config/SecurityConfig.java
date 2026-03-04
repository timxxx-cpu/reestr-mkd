package uz.reestr.mkd.backendjpa.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            // Подключаем наши настройки CORS из файла CorsConfig.java
            .cors(Customizer.withDefaults())
            
            // Отключаем защиту от CSRF-атак, так как для REST API (с JWT токенами) она не нужна
            .csrf(csrf -> csrf.disable())
            
            // Устанавливаем stateless-сессии (без сохранения состояния на сервере)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            
            // ВРЕМЕННО разрешаем доступ ко всем эндпоинтам без авторизации
            // Позже, когда вы будете переносить логику проверки JWT, вы измените это правило
            .authorizeHttpRequests(auth -> auth
                .anyRequest().permitAll()
            );

        return http.build();
    }
}