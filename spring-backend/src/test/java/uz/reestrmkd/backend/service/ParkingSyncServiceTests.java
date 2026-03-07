package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.registry.service.ParkingSyncService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ParkingSyncServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @InjectMocks
    private ParkingSyncService parkingSyncService;

    @Test
    void shouldReturnZeroChangesWhenCurrentMatchesTarget() {
        UUID floorId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(any(String.class), eq(floorId)))
            .thenReturn(List.of(Map.of("id", UUID.randomUUID(), "number", 1)));

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 1);

        assertThat(result.added()).isZero();
        assertThat(result.removed()).isZero();
        verify(jdbcTemplate, never()).update(startsWith("insert into units"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldAddParkingPlacesWhenTargetIsGreaterThanCurrent() {
        UUID floorId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(any(String.class), eq(floorId))).thenReturn(List.of());
        when(jdbcTemplate.update(startsWith("insert into units"), eq(floorId), isNull(), eq("parking_place"), isNull(), eq("free"), any(), any()))
            .thenReturn(1);

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 2);

        assertThat(result.added()).isEqualTo(2);
        assertThat(result.removed()).isZero();
        verify(jdbcTemplate, times(2)).update(startsWith("insert into units"), eq(floorId), isNull(), eq("parking_place"), isNull(), eq("free"), any(), any());
    }

    @Test
    void shouldRemoveHighestNumbersWhenTargetIsLowerThanCurrent() {
        UUID floorId = UUID.randomUUID();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID third = UUID.randomUUID();
        when(jdbcTemplate.queryForList(any(String.class), eq(floorId))).thenReturn(List.of(
            Map.of("id", first, "number", 1),
            Map.of("id", second, "number", 3),
            Map.of("id", third, "number", 2)
        ));
        when(jdbcTemplate.update(eq("delete from units where id = ?"), eq(second))).thenReturn(1);
        when(jdbcTemplate.update(eq("delete from units where id = ?"), eq(third))).thenReturn(1);

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 1);

        assertThat(result.added()).isZero();
        assertThat(result.removed()).isEqualTo(2);
        verify(jdbcTemplate).update(eq("delete from units where id = ?"), eq(second));
        verify(jdbcTemplate).update(eq("delete from units where id = ?"), eq(third));
    }
}