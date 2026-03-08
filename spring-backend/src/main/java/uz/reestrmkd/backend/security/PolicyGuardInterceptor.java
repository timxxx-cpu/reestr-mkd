package uz.reestrmkd.backend.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;
import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.exception.ApiException;

@Component
public class PolicyGuardInterceptor implements HandlerInterceptor {

    private final SecurityPolicyService securityPolicyService;

    public PolicyGuardInterceptor(SecurityPolicyService securityPolicyService) {
        this.securityPolicyService = securityPolicyService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        PolicyGuard policy = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getMethod(), PolicyGuard.class);
        if (policy == null) {
            policy = AnnotatedElementUtils.findMergedAnnotation(handlerMethod.getBeanType(), PolicyGuard.class);
        }
        if (policy == null) {
            return true;
        }

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ActorPrincipal actor)) {
            throw new ApiException(policy.message(), "FORBIDDEN", null, 403);
        }

        securityPolicyService.requireAllowed(actor.userRoleId(), policy.domain(), policy.action(), policy.message());
        return true;
    }
}
