package uz.reestrmkd.backendjpa.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Slf4j
@Configuration
public class SecurityConfig {
    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        log.info("Security Filter Chain");
        http
                .cors(Customizer.withDefaults()) // Включаем поддержку CORS в Spring Security
                .csrf(AbstractHttpConfigurer::disable)    // Для REST API CSRF обычно отключают
                .authorizeHttpRequests(auth -> auth
                        // Обязательно разрешаем все OPTIONS запросы
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        // Остальные правила...
                        .anyRequest().permitAll()
                );

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Указываем РЕАЛЬНЫЙ адрес вашего фронтенда
        configuration.setAllowedOrigins(List.of("*" ));

        // Разрешаем нужные методы
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));

        // Разрешаем любые заголовки (включая ваши x-client-request-id и x-operation-source)
        configuration.setAllowedHeaders(List.of("*"));


        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
