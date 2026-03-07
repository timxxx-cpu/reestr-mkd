package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.common.service.UjIdentifierService;
import uz.reestrmkd.backend.domain.registry.service.ParkingSyncService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class ParkingSyncServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private UjIdentifierService ujIdentifierService;

    @InjectMocks
    private ParkingSyncService parkingSyncService;

    @Test
    void shouldReturnZeroChangesWhenCurrentMatchesTarget() {
        UUID floorId = UUID.randomUUID();
        when(jdbcTemplate.queryForList(any(String.class), eq(floorId)))
            .thenReturn(List.of(Map.of("id", UUID.randomUUID(), "number", 1, "unit_code", "UJ000001-ZP01-EP0001")));

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 1);

        assertThat(result.added()).isZero();
        assertThat(result.removed()).isZero();
        verify(jdbcTemplate, never()).update(startsWith("insert into units"), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void shouldAddParkingPlacesWhenTargetIsGreaterThanCurrent() {
        UUID floorId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();

        when(jdbcTemplate.queryForList(argThat(sql -> sql != null && sql.contains("select id, number, unit_code from units")), eq(floorId))).thenReturn(List.of());
        when(jdbcTemplate.queryForList(argThat(sql -> sql != null && sql.contains("select bb.building_id")), eq(floorId))).thenReturn(List.of(
            Map.of("building_id", buildingId, "building_code", "UJ000001-ZP01", "uj_code", "UJ000001")
        ));
        when(jdbcTemplate.queryForList(argThat(sql -> sql != null && sql.contains("select u.unit_code from units")), eq(String.class), eq(buildingId))).thenReturn(List.of());

        when(ujIdentifierService.getUnitPrefix("parking_place")).thenReturn("EP");
        when(ujIdentifierService.getNextSequenceNumber(anyList(), eq("UJ000001-ZP01-EP"))).thenReturn(1);
        when(ujIdentifierService.generateUnitCode(eq("UJ000001-ZP01-EP"), anyInt())).thenAnswer(invocation -> {
            int seq = invocation.getArgument(1, Integer.class);
            return String.format("UJ000001-ZP01-EP%04d", seq);
        });

        when(jdbcTemplate.update(startsWith("insert into units"), eq(floorId), isNull(), eq("parking_place"), isNull(), eq("free"), eq(false), anyString()))
            .thenReturn(1);

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 2);

        assertThat(result.added()).isEqualTo(2);
        assertThat(result.removed()).isZero();
        verify(jdbcTemplate, times(2)).update(startsWith("insert into units"), eq(floorId), isNull(), eq("parking_place"), isNull(), eq("free"), eq(false), anyString());
    }

    @Test
    void shouldRemoveHighestNumbersWhenTargetIsLowerThanCurrent() {
        UUID floorId = UUID.randomUUID();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        UUID third = UUID.randomUUID();
        when(jdbcTemplate.queryForList(any(String.class), eq(floorId))).thenReturn(List.of(
            Map.of("id", first, "number", 1, "unit_code", "UJ000001-ZP01-EP0001"),
            Map.of("id", second, "number", 3, "unit_code", "UJ000001-ZP01-EP0003"),
            Map.of("id", third, "number", 2, "unit_code", "UJ000001-ZP01-EP0002")
        ));
        when(jdbcTemplate.update(eq("delete from units where id = ?"), eq(second))).thenReturn(1);
        when(jdbcTemplate.update(eq("delete from units where id = ?"), eq(third))).thenReturn(1);

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 1);

        assertThat(result.added()).isZero();
        assertThat(result.removed()).isEqualTo(2);
        verify(jdbcTemplate).update(eq("delete from units where id = ?"), eq(second));
        verify(jdbcTemplate).update(eq("delete from units where id = ?"), eq(third));
    }

    @Test
    void shouldBackfillMissingCodesWhenCountMatchesTarget() {
        UUID floorId = UUID.randomUUID();
        UUID buildingId = UUID.randomUUID();
        UUID unitId = UUID.randomUUID();

        when(jdbcTemplate.queryForList(argThat(sql -> sql != null && sql.contains("select id, number, unit_code from units")), eq(floorId))).thenReturn(List.of(
            Map.of("id", unitId, "number", 1, "unit_code", "")
        ));
        when(jdbcTemplate.queryForList(argThat(sql -> sql != null && sql.contains("select bb.building_id")), eq(floorId))).thenReturn(List.of(
            Map.of("building_id", buildingId, "building_code", "UJ000001-ZP01", "uj_code", "UJ000001")
        ));
        when(jdbcTemplate.queryForList(argThat(sql -> sql != null && sql.contains("select u.unit_code from units")), eq(String.class), eq(buildingId))).thenReturn(List.of("UJ000001-ZP01-EP0001"));
        when(ujIdentifierService.getUnitPrefix("parking_place")).thenReturn("EP");
        when(ujIdentifierService.getNextSequenceNumber(anyList(), eq("UJ000001-ZP01-EP"))).thenReturn(2);
        when(ujIdentifierService.generateUnitCode(eq("UJ000001-ZP01-EP"), eq(2))).thenReturn("UJ000001-ZP01-EP0002");

        ParkingSyncService.ParkingSyncResult result = parkingSyncService.syncParkingPlaces(floorId, 1);

        assertThat(result.added()).isZero();
        assertThat(result.removed()).isZero();
        verify(jdbcTemplate).update(eq("update units set unit_code=?, updated_at=now() where id=?"), eq("UJ000001-ZP01-EP0002"), eq(unitId));
    }
}
