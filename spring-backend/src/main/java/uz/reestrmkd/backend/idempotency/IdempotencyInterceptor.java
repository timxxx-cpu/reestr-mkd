package uz.reestrmkd.backend.idempotency;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.HandlerMapping;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
public class IdempotencyInterceptor implements HandlerInterceptor {

    public static final String IDEMPOTENCY_CONTEXT_ATTRIBUTE = "IDEMPOTENCY_CONTEXT";

    private final IdempotencyService idempotencyService;
    private final ObjectMapper objectMapper;

    public IdempotencyInterceptor(IdempotencyService idempotencyService, ObjectMapper objectMapper) {
        this.idempotencyService = idempotencyService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        IdempotencyContext context = buildContext(request);
        if (context == null) {
            return true;
        }

        request.setAttribute(IDEMPOTENCY_CONTEXT_ATTRIBUTE, context);

        IdempotencyService.IdempotencyState state = idempotencyService.get(context.cacheKey(), context.fingerprint());
        if ("hit".equals(state.status())) {
            response.setStatus(HttpServletResponse.SC_OK);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            objectMapper.writeValue(response.getWriter(), state.value());
            return false;
        }

        if ("conflict".equals(state.status())) {
            response.setStatus(HttpServletResponse.SC_CONFLICT);
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("code", "IDEMPOTENCY_CONFLICT");
            payload.put("message", "Idempotency key was already used with a different payload");
            payload.put("details", null);
            objectMapper.writeValue(response.getWriter(), payload);
            return false;
        }

        return true;
    }

    private IdempotencyContext buildContext(HttpServletRequest request) {
        String rawKey = request.getHeader("x-idempotency-key");
        if (rawKey == null || rawKey.trim().isEmpty()) {
            return null;
        }

        String key = rawKey.trim();
        String scope = resolveScope(request);
        String actorScope = resolveActorScope();
        String bodyFingerprint = resolveBodyFingerprint(request);

        String cacheKey = scope + ":" + actorScope + ":" + key;
        String fingerprint = request.getMethod() + ":" + scope + ":" + bodyFingerprint;
        return new IdempotencyContext(cacheKey, fingerprint);
    }

    private String resolveScope(HttpServletRequest request) {
        Object pattern = request.getAttribute(HandlerMapping.BEST_MATCHING_PATTERN_ATTRIBUTE);
        if (pattern != null) {
            return pattern.toString();
        }
        String uri = request.getRequestURI();
        return uri == null ? "unknown" : uri;
    }

    private String resolveActorScope() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof ActorPrincipal actorPrincipal) {
            return actorPrincipal.userId();
        }
        return "anonymous";
    }

    private String resolveBodyFingerprint(HttpServletRequest request) {
        if (!(request instanceof CachedBodyHttpServletRequest cached)) {
            return "null";
        }

        String rawBody = new String(cached.getCachedBody(), StandardCharsets.UTF_8).trim();
        if (rawBody.isEmpty()) {
            return "null";
        }

        try {
            JsonNode node = objectMapper.readTree(rawBody);
            return objectMapper.writeValueAsString(node);
        } catch (Exception ex) {
            return rawBody;
        }
    }
}
