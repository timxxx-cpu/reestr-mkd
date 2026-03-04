package uz.reestr.mkd.backendjpa.config;

import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

  @Bean
  public WebMvcConfigurer corsWebMvcConfigurer(
      @Value("${app.cors.allowed-origins:http://localhost:5173}") List<String> allowedOrigins
  ) {
    return new WebMvcConfigurer() {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
            .allowedOrigins(allowedOrigins.toArray(String[]::new))
            .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
            .allowedHeaders(
                "Authorization",
                "Content-Type",
                "x-client-request-id",
                "x-idempotency-key",
                "x-user-id",
                "x-user-role"
            )
            .exposedHeaders(
                "Authorization",
                "x-client-request-id",
                "x-idempotency-key",
                "x-user-id",
                "x-user-role"
            )
            .allowCredentials(true);
      }
    };
  }

  @Bean
  public CorsConfigurationSource corsConfigurationSource(
      @Value("${app.cors.allowed-origins:http://localhost:5173}") List<String> allowedOrigins
  ) {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(allowedOrigins);
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    config.setAllowedHeaders(List.of(
        "Authorization",
        "Content-Type",
        "x-client-request-id",
        "x-idempotency-key",
        "x-user-id",
        "x-user-role"
    ));
    config.setExposedHeaders(List.of(
        "Authorization",
        "x-client-request-id",
        "x-idempotency-key",
        "x-user-id",
        "x-user-role"
    ));
    config.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
  }
}
