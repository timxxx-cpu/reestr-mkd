package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.catalog.api.CatalogActiveRequestDto;
import uz.reestrmkd.backend.domain.catalog.api.CatalogUpsertRequestDto;
import uz.reestrmkd.backend.domain.catalog.service.CatalogService;
import uz.reestrmkd.backend.exception.ApiException;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    void shouldReadCatalogRows() {
        CatalogService service = new CatalogService(jdbcTemplate);
        List<Map<String, Object>> rows = List.of(Map.of("id", "x1"));

        when(jdbcTemplate.queryForList(anyString())).thenReturn(rows);

        List<Map<String, Object>> response = service.getCatalog("regions", "true");

        assertThat(response).isSameAs(rows);
        verify(jdbcTemplate).queryForList(
            "select id, soato, name_ru, name_uz, ordering, status from regions where status = 1 order by ordering asc, name_ru asc nulls last, name_uz asc nulls last"
        );
    }

    @Test
    void shouldRejectUnknownCatalogTable() {
        CatalogService service = new CatalogService(jdbcTemplate);

        assertThatThrownBy(() -> service.getCatalog("hack_table", null))
            .isInstanceOf(ApiException.class)
            .hasMessage("РўР°Р±Р»РёС†Р° РЅРµ СЂР°Р·СЂРµС€РµРЅР°");
    }

    @Test
    void shouldUpsertFilteredPayload() {
        CatalogService service = new CatalogService(jdbcTemplate);
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), eq("dict_unit_types")))
            .thenReturn(List.of("id", "label", "sort_order", "is_active"));

        service.upsert(
            "dict_unit_types",
            new CatalogUpsertRequestDto(Map.of(
                "id", " flat ",
                "label", "Flat",
                "sortOrder", 5,
                "isActive", false,
                "ignored", "x"
            ))
        );

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> argsCaptor = ArgumentCaptor.forClass(Object[].class);
        verify(jdbcTemplate).update(sqlCaptor.capture(), argsCaptor.capture());

        assertThat(sqlCaptor.getValue()).isEqualTo(
            "insert into dict_unit_types(id,label,sort_order,is_active) values (?,?,?,?) on conflict (id) do update set label = EXCLUDED.label,sort_order = EXCLUDED.sort_order,is_active = EXCLUDED.is_active"
        );
        assertThat(argsCaptor.getValue()).containsExactly("flat", "Flat", 5, false);
    }

    @Test
    void shouldSetCatalogActiveFlag() {
        CatalogService service = new CatalogService(jdbcTemplate);

        service.setActive("dict_unit_types", "flat", new CatalogActiveRequestDto(false));

        verify(jdbcTemplate).update("update dict_unit_types set is_active = ? where id = ?", false, "flat");
    }
}
