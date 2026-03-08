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
import java.util.Objects;

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
            @SuppressWarnings("null")
            public void addCorsMappings(@NonNull CorsRegistry registry) {
                CorsConfiguration cors = buildCorsConfiguration();

                // Явно извлекаем списки и проверяем на null
                List<String> origins = cors.getAllowedOriginPatterns();
                List<String> methods = cors.getAllowedMethods();
                List<String> headers = cors.getAllowedHeaders();
                Long maxAge = cors.getMaxAge();

                // Формируем массивы (это полностью исключит предупреждения "Null type safety" и "Potential null pointer")
                String[] originsArray = origins != null ? origins.toArray(new String[0]) : new String[0];
                String[] methodsArray = methods != null ? methods.toArray(new String[0]) : new String[0];
                String[] headersArray = headers != null ? headers.toArray(new String[0]) : new String[0];
                long maxAgeValue = maxAge != null ? maxAge : 3600L; // Безопасная распаковка (auto-unboxing)

                registry.addMapping("/**")
                    .allowedOriginPatterns(originsArray)
                    .allowedMethods(methodsArray)
                    .allowedHeaders(headersArray)
                    .allowCredentials(Boolean.TRUE.equals(cors.getAllowCredentials()))
                    .maxAge(maxAgeValue);
            }
        };
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = buildCorsConfiguration();
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", Objects.requireNonNull(configuration));
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
            "x-user-role-id",
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
