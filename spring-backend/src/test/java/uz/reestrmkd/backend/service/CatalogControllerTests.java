package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.catalog.api.CatalogActiveRequestDto;
import uz.reestrmkd.backend.domain.catalog.api.CatalogController;
import uz.reestrmkd.backend.domain.catalog.api.CatalogUpsertRequestDto;
import uz.reestrmkd.backend.domain.catalog.service.CatalogService;
import uz.reestrmkd.backend.domain.common.api.ItemsResponseDto;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogControllerTests {

    @Mock
    private CatalogService catalogService;

    private CatalogController controller;

    @BeforeEach
    void setUp() {
        controller = new CatalogController(catalogService, new SecurityPolicyService());
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void shouldDelegateGetCatalogToService() {
        List<Map<String, Object>> rows = List.of(Map.of("id", "x1"));
        when(catalogService.getCatalog("regions", "true")).thenReturn(rows);

        ItemsResponseDto response = controller.getCatalog("regions", "true");

        verify(catalogService).getCatalog("regions", "true");
        assertThat(response.items()).isSameAs(rows);
    }

    @Test
    void shouldDelegateUpsertToServiceWhenPolicyAllows() {
        setActor("branch_manager");
        CatalogUpsertRequestDto request = new CatalogUpsertRequestDto(Map.of("id", "x1"));

        boolean ok = controller.upsert("dict_unit_types", request).ok();

        verify(catalogService).upsert("dict_unit_types", request);
        assertThat(ok).isTrue();
    }

    @Test
    void shouldRejectUpsertWithoutPolicy() {
        setActor("technician");

        assertThatThrownBy(() -> controller.upsert("dict_unit_types", new CatalogUpsertRequestDto(Map.of("id", "x1"))))
            .isInstanceOf(ApiException.class)
            .hasMessage("Role cannot modify catalogs");
    }

    @Test
    void shouldDelegateSetActiveToService() {
        setActor("branch_manager");

        boolean ok = controller.setActive("dict_unit_types", "x1", new CatalogActiveRequestDto(true)).getBody().ok();

        verify(catalogService).setActive("dict_unit_types", "x1", new CatalogActiveRequestDto(true));
        assertThat(ok).isTrue();
    }

    private void setActor(String role) {
        SecurityContextHolder.getContext().setAuthentication(
            new UsernamePasswordAuthenticationToken(new ActorPrincipal("u1", role, "bff"), null)
        );
    }
}
