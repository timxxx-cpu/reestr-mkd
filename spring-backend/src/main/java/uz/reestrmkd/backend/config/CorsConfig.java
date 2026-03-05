package uz.reestrmkd.backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.lang.NonNull;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
public class CorsConfig {

    private final AppProperties appProperties;

    public CorsConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Bean
    public WebMvcConfigurer webMvcConfigurer() {
        return new WebMvcConfigurer() {
            @Override
           public void addCorsMappings(@NonNull CorsRegistry registry) {
                CorsConfiguration cors = buildCorsConfiguration();
                registry.addMapping("/**")
                    .allowedOriginPatterns(cors.getAllowedOriginPatterns().toArray(String[]::new))
                    .allowedMethods(cors.getAllowedMethods().toArray(String[]::new))
                    .allowedHeaders(cors.getAllowedHeaders().toArray(String[]::new))
                    .allowCredentials(Boolean.TRUE.equals(cors.getAllowCredentials()))
                    .maxAge(cors.getMaxAge() == null ? 3600 : cors.getMaxAge());
            }
        };
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = buildCorsConfiguration();
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    private CorsConfiguration buildCorsConfiguration() {
        CorsConfiguration cors = new CorsConfiguration();

        List<String> configuredOrigins = Arrays.stream(String.valueOf(appProperties.getCors().getOrigin()).split(","))
            .map(String::trim)
            .filter(s -> !s.isBlank())
            .collect(Collectors.toList());

        boolean isDev = "dev".equalsIgnoreCase(appProperties.getRuntimeEnv());
        boolean allowAll = isDev || configuredOrigins.contains("*");

        if (allowAll) {
            cors.setAllowedOriginPatterns(List.of("*"));
        } else if (!configuredOrigins.isEmpty()) {
            cors.setAllowedOriginPatterns(configuredOrigins.stream().map(this::stripTrailingSlash).toList());
        } else {
            cors.setAllowedOriginPatterns(List.of(
                "https://reestr-mkd.vercel.app",
                "http://localhost:5173",
                "http://localhost:4173"
            ));
        }

        cors.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        cors.setAllowedHeaders(List.of(
            "Content-Type",
            "Authorization",
            "Accept",
            "Origin",
            "x-user-id",
            "x-user-role",
            "x-idempotency-key",
            "x-client-request-id",
            "x-operation-source"
        ));
        cors.setAllowCredentials(false);
        cors.setMaxAge(3600L);
        return cors;
    }

    private String stripTrailingSlash(String value) {
        return value != null ? value.replaceAll("/+$", "") : "";
    }
}
