package uz.reestrmkd.backendjpa.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import uz.reestrmkd.backendjpa.api.error.ApiErrorException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LockJpaServiceTest {

    @Mock
    private NamedParameterJdbcTemplate jdbc;

    private LockJpaService service;

    @BeforeEach
    void setUp() {
        service = new LockJpaService(jdbc);
    }

    @Test
    void acquire_maps_not_found_reason_to_404() {
        when(jdbc.queryForList(anyString(), anyMap())).thenReturn(List.of(Map.of(
            "ok", false,
            "reason", "NOT_FOUND",
            "message", "Application not found"
        )));

        ApiErrorException ex = assertThrows(ApiErrorException.class,
            () -> service.acquire("app-1", "u-1", "admin", 120));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
        assertEquals("NOT_FOUND", ex.getCode());
    }

    @Test
    void refresh_maps_owner_mismatch_to_conflict() {
        when(jdbc.queryForList(anyString(), anyMap())).thenReturn(List.of(Map.of(
            "ok", false,
            "reason", "OWNER_MISMATCH",
            "message", "Not owner"
        )));

        ApiErrorException ex = assertThrows(ApiErrorException.class,
            () -> service.refresh("app-1", "u-2", 120));

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertEquals("OWNER_MISMATCH", ex.getCode());
    }

    @Test
    void acquire_maps_assignee_mismatch_to_forbidden() {
        when(jdbc.queryForList(anyString(), anyMap())).thenReturn(List.of(Map.of(
            "ok", false,
            "reason", "ASSIGNEE_MISMATCH",
            "message", "Assignee mismatch"
        )));

        ApiErrorException ex = assertThrows(ApiErrorException.class,
            () -> service.acquire("app-1", "u-1", "admin", 120));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertEquals("ASSIGNEE_MISMATCH", ex.getCode());
    }

    @Test
    void acquire_does_not_pre_delete_lock_row() {
        when(jdbc.queryForList(anyString(), anyMap())).thenReturn(List.of(Map.of(
            "ok", true,
            "reason", "ACQUIRED",
            "message", "ok",
            "expires_at", "2026-01-01T00:00:00Z"
        )));

        service.acquire("app-1", "u-1", "admin", 120);

        verify(jdbc, never()).update(org.mockito.ArgumentMatchers.contains("delete from application_locks"), anyMap());
    }

}
