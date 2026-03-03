package uz.reestr.mkd.backendjpa.idempotency;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;
import uz.reestr.mkd.backendjpa.idempotency.IdempotencyStoreService.LookupResult;

@Component
public class IdempotencyFilter extends OncePerRequestFilter {

  private static final String IDEMPOTENCY_HEADER = "x-idempotency-key";

  private final IdempotencyStoreService idempotencyStoreService;

  public IdempotencyFilter(IdempotencyStoreService idempotencyStoreService) {
    this.idempotencyStoreService = idempotencyStoreService;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    String method = request.getMethod();
    boolean supportedMethod = "POST".equals(method)
        || "PUT".equals(method)
        || "PATCH".equals(method)
        || "DELETE".equals(method);
    if (!supportedMethod) {
      return true;
    }

    String raw = request.getHeader(IDEMPOTENCY_HEADER);
    return raw == null || raw.trim().isEmpty();
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    String idempotencyKey = request.getHeader(IDEMPOTENCY_HEADER).trim();
    String scope = request.getRequestURI();
    String actorScope = request.getHeader("x-user-id") != null ? request.getHeader("x-user-id") : "anonymous";
    String bodyFingerprint = request.getHeader("content-length") != null ? request.getHeader("content-length") : "0";

    String cacheKey = scope + ":" + actorScope + ":" + idempotencyKey;
    String fingerprint = request.getMethod() + ":" + scope + ":" + bodyFingerprint;

    LookupResult existing = idempotencyStoreService.get(cacheKey, fingerprint);
    if ("hit".equals(existing.status())) {
      response.setStatus(existing.entry().status());
      if (existing.entry().contentType() != null) {
        response.setContentType(existing.entry().contentType());
      }
      response.getOutputStream().write(existing.entry().body());
      return;
    }

    if ("conflict".equals(existing.status())) {
      response.setStatus(HttpStatus.CONFLICT.value());
      response.setContentType("application/json");
      response.getWriter().write("{\"code\":\"IDEMPOTENCY_CONFLICT\",\"message\":\"Idempotency key was already used with a different payload\"}");
      return;
    }

    ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(response);
    filterChain.doFilter(request, responseWrapper);

    byte[] responseBody = responseWrapper.getContentAsByteArray();
    if (responseWrapper.getStatus() < 500) {
      idempotencyStoreService.set(
          cacheKey,
          fingerprint,
          responseWrapper.getStatus(),
          responseWrapper.getContentType(),
          responseBody
      );
    }

    responseWrapper.copyBodyToResponse();
  }
}
