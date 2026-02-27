package uz.reestrmkd.backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import uz.reestrmkd.backend.common.ApiException;
import uz.reestrmkd.backend.config.AppProperties;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;

import static org.springframework.http.HttpStatus.UNAUTHORIZED;

@Component
public class AuthFilter extends OncePerRequestFilter {
    private static final Set<String> FORBIDDEN_DEV = Set.of("production", "prod", "preprod", "staging");

    private final AppProperties props;
    private final JwtHs256Service jwtService;

    public AuthFilter(AppProperties props, JwtHs256Service jwtService) {
        this.props = props;
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {

        String requestId = UUID.randomUUID().toString();
        request.setAttribute("requestId", requestId);
        response.setHeader("x-request-id", requestId);
        response.setHeader("x-operation-source", request.getHeader("x-operation-source") == null ? "unknown" : request.getHeader("x-operation-source"));

        String path = request.getRequestURI();
        if (!path.startsWith("/api/v1/") || "/api/v1/auth/login".equals(path) || "/health".equals(path)
            || "/api/v1/catalogs/dict_system_users".equals(path)) {
            chain.doFilter(request, response);
            return;
        }

        String authMode = props.getAuthMode();
        if ("dev".equals(authMode) && FORBIDDEN_DEV.contains(props.getRuntimeEnv().toLowerCase())) {
            throw new ApiException(UNAUTHORIZED, "UNAUTHORIZED", "AUTH_MODE=dev is forbidden for runtime env");
        }

        AuthContext authContext = null;
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ") && !props.getJwtSecret().isBlank()) {
            var payload = jwtService.verify(authHeader.substring(7).trim(), props.getJwtSecret());
            if (payload != null) {
                String userId = string(payload.get("sub"), payload.get("userId"), payload.get("user_id"));
                String userRole = string(payload.get("role"), payload.get("userRole"), payload.get("user_role"));
                if (!userId.isBlank() && !userRole.isBlank()) authContext = new AuthContext(userId, userRole, "jwt");
            } else if ("jwt".equals(authMode)) {
                throw new ApiException(UNAUTHORIZED, "UNAUTHORIZED", "JWT auth failed");
            }
        } else if ("jwt".equals(authMode)) {
            throw new ApiException(UNAUTHORIZED, "UNAUTHORIZED", "Missing Bearer token");
        }

        if (authContext == null && "dev".equals(authMode)) {
            String userId = request.getHeader("x-user-id");
            String userRole = request.getHeader("x-user-role");
            if (userId != null && userRole != null && !userId.isBlank() && !userRole.isBlank()) {
                authContext = new AuthContext(userId, userRole, "headers");
            }
        }

        if ("jwt".equals(authMode) && authContext == null) {
            throw new ApiException(UNAUTHORIZED, "UNAUTHORIZED", "Unable to resolve auth context");
        }

        try {
            RequestContextHolder.set(authContext);
            chain.doFilter(request, response);
        } finally {
            RequestContextHolder.clear();
        }
    }

    private String string(Object... values) {
        for (Object v : values) if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v);
        return "";
    }
}
