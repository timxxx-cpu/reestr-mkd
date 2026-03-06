package uz.reestrmkd.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import uz.reestrmkd.backend.idempotency.IdempotencyInterceptor;
import uz.reestrmkd.backend.security.CurrentUserArgumentResolver;

import java.util.List;
import java.util.Objects;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final IdempotencyInterceptor idempotencyInterceptor;
    private final CurrentUserArgumentResolver currentUserArgumentResolver;

    // Внедряем оба компонента через конструктор
    public WebMvcConfig(IdempotencyInterceptor idempotencyInterceptor, 
                        CurrentUserArgumentResolver currentUserArgumentResolver) {
        this.idempotencyInterceptor = idempotencyInterceptor;
        this.currentUserArgumentResolver = currentUserArgumentResolver;
    }

    @Override
    public void addInterceptors(@NonNull InterceptorRegistry registry) {
        registry.addInterceptor(Objects.requireNonNull(idempotencyInterceptor)).addPathPatterns("/api/v1/**");
    }

    // Регистрируем наш новый резолвер
    @Override
    public void addArgumentResolvers(@NonNull List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserArgumentResolver);
    }
}