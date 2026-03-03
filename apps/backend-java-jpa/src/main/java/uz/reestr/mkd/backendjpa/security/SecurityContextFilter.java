package uz.reestr.mkd.backendjpa.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Profile("dev")
public class SecurityContextFilter extends OncePerRequestFilter {

  @Override
  protected void doFilterInternal(
      HttpServletRequest request,
      HttpServletResponse response,
      FilterChain filterChain
  ) throws ServletException, IOException {
    if (SecurityContextHolder.getContext().getAuthentication() == null) {
      String rawUserId = request.getHeader("x-user-id");
      String userRole = request.getHeader("x-user-role");

      if (rawUserId != null && !rawUserId.isBlank() && userRole != null && !userRole.isBlank()) {
        String userId = URLDecoder.decode(rawUserId, StandardCharsets.UTF_8);
        String role = userRole.trim().toUpperCase();
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
            userId,
            null,
            List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
        SecurityContextHolder.getContext().setAuthentication(authentication);
      }
    }

    filterChain.doFilter(request, response);
  }
}
