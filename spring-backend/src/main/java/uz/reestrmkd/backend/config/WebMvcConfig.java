package uz.reestrmkd.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import uz.reestrmkd.backend.idempotency.IdempotencyInterceptor;
import org.springframework.lang.NonNull;
import java.util.Objects;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final IdempotencyInterceptor idempotencyInterceptor;

    public WebMvcConfig(IdempotencyInterceptor idempotencyInterceptor) {
        this.idempotencyInterceptor = idempotencyInterceptor;
    }

   @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(Objects.requireNonNull(idempotencyInterceptor)).addPathPatterns("/api/v1/**");
    }
}
