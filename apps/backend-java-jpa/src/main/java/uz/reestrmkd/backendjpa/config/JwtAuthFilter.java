package uz.reestrmkd.backendjpa.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import uz.reestrmkd.backendjpa.service.JwtService;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtService jwtService;

    @Value("${app.jwt-secret:}")
    private String jwtSecret;

    @Value("${app.auth-mode:jwt}")
    private String authMode;

    public JwtAuthFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        return uri.startsWith("/actuator")
            || uri.equals("/api/v1/auth/login")
            || uri.equals("/api/v1/catalogs/dict_system_users")
            || uri.equals("/api/v1/health");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {
        String authz = request.getHeader("Authorization");
        if (authz != null && authz.startsWith("Bearer ")) {
            String token = authz.substring(7).trim();
            try {
                Map<String, Object> payload = jwtService.verify(token, jwtSecret);
                String userId = payload.get("sub") == null ? null : String.valueOf(payload.get("sub"));
                String role = payload.get("role") == null ? "user" : String.valueOf(payload.get("role"));
                authenticate(userId, role);
                request.setAttribute("auth.userId", userId);
                request.setAttribute("auth.role", role);
            } catch (RuntimeException ex) {
                unauthorized(response, "UNAUTHORIZED", "JWT auth failed: invalid token");
                return;
            }
        } else if ("dev".equalsIgnoreCase(authMode)) {
            String userId = request.getHeader("X-User-Id");
            String role = request.getHeader("X-User-Role");
            if (userId != null && !userId.isBlank()) {
                String resolvedRole = (role == null || role.isBlank()) ? "user" : role;
                authenticate(userId, resolvedRole);
                request.setAttribute("auth.userId", userId);
                request.setAttribute("auth.role", resolvedRole);
            }
        }

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            unauthorized(response, "UNAUTHORIZED", "Missing Bearer token");
            return;
        }

        if (isMutation(request) && request.getAttribute("auth.role") == null) {
            forbidden(response, "FORBIDDEN", "Policy actor role is required");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean isMutation(HttpServletRequest request) {
        String method = request.getMethod().toUpperCase(Locale.ROOT);
        return HttpMethod.POST.matches(method)
            || HttpMethod.PUT.matches(method)
            || HttpMethod.PATCH.matches(method)
            || HttpMethod.DELETE.matches(method);
    }

    private void authenticate(String userId, String role) {
        var auth = new UsernamePasswordAuthenticationToken(
            userId,
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + role.toUpperCase(Locale.ROOT)))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
    }

    private void unauthorized(HttpServletResponse response, String code, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\",\"details\":null}");
    }

    private void forbidden(HttpServletResponse response, String code, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message + "\",\"details\":null}");
    }
}
