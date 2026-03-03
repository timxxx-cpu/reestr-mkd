package uz.reestrmkd.backendjpa.service;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;

class LockJpaServiceTest {

    @Test
    void formatApiTimestamp_trims_fractional_trailing_zeros() throws Exception {
        LockJpaService service = new LockJpaService(mock(NamedParameterJdbcTemplate.class));
        Method m = LockJpaService.class.getDeclaredMethod("formatApiTimestamp", Object.class);
        m.setAccessible(true);

        String value = (String) m.invoke(service, "2026-03-03T12:51:22.755840+00:00");

        assertEquals("2026-03-03T12:51:22.75584+00:00", value);
    }
}