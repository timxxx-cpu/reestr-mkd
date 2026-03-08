package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.method.HandlerMethod;
import uz.reestrmkd.backend.domain.auth.api.AuthController;
import uz.reestrmkd.backend.domain.auth.service.AuthService;
import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.catalog.api.CatalogController;
import uz.reestrmkd.backend.domain.catalog.service.CatalogService;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.security.PolicyGuardInterceptor;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class PolicyGuardInterceptorTests {

    private final PolicyGuardInterceptor interceptor = new PolicyGuardInterceptor(new SecurityPolicyService());

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldAllowReadAccessForAnnotatedControllerClass() throws Exception {
        setActor("controller");
        HandlerMethod handlerMethod = handlerMethod(
            new CatalogController(mock(CatalogService.class), new SecurityPolicyService()),
            "getCatalog",
            String.class,
            String.class
        );

        boolean allowed = interceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), handlerMethod);

        assertThat(allowed).isTrue();
    }

    @Test
    void shouldRejectMethodLevelPolicyOverride() throws Exception {
        setActor("technician");
        HandlerMethod handlerMethod = handlerMethod(
            new CatalogController(mock(CatalogService.class), new SecurityPolicyService()),
            "upsert",
            String.class,
            uz.reestrmkd.backend.domain.catalog.api.CatalogUpsertRequestDto.class
        );

        assertThatThrownBy(() -> interceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), handlerMethod))
            .isInstanceOf(ApiException.class)
            .hasMessage("Role cannot modify catalogs");
    }

    @Test
    void shouldSkipHandlersWithoutPolicyAnnotation() throws Exception {
        HandlerMethod handlerMethod = handlerMethod(
            new AuthController(mock(AuthService.class)),
            "login",
            uz.reestrmkd.backend.domain.auth.api.LoginRequestDto.class
        );

        boolean allowed = interceptor.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), handlerMethod);

        assertThat(allowed).isTrue();
    }

    private HandlerMethod handlerMethod(Object bean, String methodName, Class<?>... parameterTypes) throws NoSuchMethodException {
        Method method = bean.getClass().getMethod(methodName, parameterTypes);
        return new HandlerMethod(bean, method);
    }

    private void setActor(String role) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", role, "bff"), null)
        );
    }
}
