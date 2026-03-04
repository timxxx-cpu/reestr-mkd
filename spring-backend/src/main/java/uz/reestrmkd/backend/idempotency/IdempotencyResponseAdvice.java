package uz.reestrmkd.backend.idempotency;

import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@ControllerAdvice(annotations = Controller.class)
public class IdempotencyResponseAdvice implements ResponseBodyAdvice<Object> {

    private final IdempotencyService idempotencyService;

    public IdempotencyResponseAdvice(IdempotencyService idempotencyService) {
        this.idempotencyService = idempotencyService;
    }

    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(
        Object body,
        MethodParameter returnType,
        MediaType selectedContentType,
        Class<? extends HttpMessageConverter<?>> selectedConverterType,
        ServerHttpRequest request,
        ServerHttpResponse response
    ) {
        if (request instanceof ServletServerHttpRequest servletRequest && response instanceof ServletServerHttpResponse servletResponse) {
            Object context = servletRequest.getServletRequest().getAttribute(IdempotencyInterceptor.IDEMPOTENCY_CONTEXT_ATTRIBUTE);
            if (context instanceof IdempotencyContext idempotencyContext) {
                int status = servletResponse.getServletResponse().getStatus();
                if (status >= 200 && status < 300) {
                    idempotencyService.set(idempotencyContext.cacheKey(), idempotencyContext.fingerprint(), body);
                }
            }
        }
        return body;
    }
}
