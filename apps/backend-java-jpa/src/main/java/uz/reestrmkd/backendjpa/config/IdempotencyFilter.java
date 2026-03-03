package uz.reestrmkd.backendjpa.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;
import uz.reestrmkd.backendjpa.api.error.ApiErrorException;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

@Component
public class IdempotencyFilter extends OncePerRequestFilter {
    private final IdempotencyStoreService store;
    public IdempotencyFilter(IdempotencyStoreService store) {
        this.store = store;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String method = request.getMethod().toUpperCase(Locale.ROOT);
        if (!(HttpMethod.POST.matches(method) || HttpMethod.PUT.matches(method) || HttpMethod.PATCH.matches(method) || HttpMethod.DELETE.matches(method))) {
            return true;
        }
        String key = request.getHeader("X-Idempotency-Key");
        if (key == null || key.isBlank()) return true;
        return !request.getRequestURI().startsWith("/api/v1/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        byte[] body = request.getInputStream().readAllBytes();
        var wrappedRequest = new CachedBodyRequest(request, body);

        String actor = request.getUserPrincipal() == null ? "anonymous" : request.getUserPrincipal().getName();
        String idemKey = request.getHeader("X-Idempotency-Key");
        String scopeKey = actor + "|" + request.getMethod() + "|" + request.getRequestURI() + "|" + idemKey;
        String fingerprint = digest(request.getMethod() + "|" + request.getRequestURI() + "|" + new String(body, StandardCharsets.UTF_8));

        var existing = store.get(scopeKey);
        if (existing != null) {
            if (!existing.fingerprint().equals(fingerprint)) {
                throw new ApiErrorException(org.springframework.http.HttpStatus.CONFLICT, "IDEMPOTENCY_CONFLICT", "Idempotency key reused with different payload");
            }
            response.setStatus(existing.status());
            if (existing.contentType() != null) response.setContentType(existing.contentType());
            response.getOutputStream().write(existing.body());
            return;
        }

        var wrappedResponse = new ContentCachingResponseWrapper(response);
        filterChain.doFilter(wrappedRequest, wrappedResponse);

        byte[] resp = wrappedResponse.getContentAsByteArray();
        int status = wrappedResponse.getStatus();
        if (status < 500) {
            store.put(scopeKey, new IdempotencyStoreService.Entry(fingerprint, status, wrappedResponse.getContentType(), resp));
        }
        wrappedResponse.copyBodyToResponse();
    }

    private String digest(String payload) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    static final class CachedBodyRequest extends HttpServletRequestWrapper {
        private final byte[] body;

        CachedBodyRequest(HttpServletRequest request, byte[] body) {
            super(request);
            this.body = body == null ? new byte[0] : body;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream bais = new ByteArrayInputStream(body);
            return new ServletInputStream() {
                @Override public int read() { return bais.read(); }
                @Override public boolean isFinished() { return bais.available() == 0; }
                @Override public boolean isReady() { return true; }
                @Override public void setReadListener(ReadListener readListener) { }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}
