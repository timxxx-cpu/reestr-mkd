package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.RoomEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.RoomJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.RegistryUnitQueryService;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class RegistryUnitQueryServiceTests {

    @Mock
    private UnitJpaRepository unitJpaRepository;

    @Mock
    private RoomJpaRepository roomJpaRepository;

    @InjectMocks
    private RegistryUnitQueryService registryUnitQueryService;

    @Test
    void shouldReturnNullWhenUnitNotFound() {
        UUID unitId = UUID.randomUUID();
        when(unitJpaRepository.findById(eq(unitId))).thenReturn(Optional.empty());

        Map<String, Object> result = registryUnitQueryService.loadUnitExplication(unitId);

        assertThat(result).isNull();
    }

    @Test
    void shouldReturnUnitWithMappedRooms() {
        UUID unitId = UUID.randomUUID();
        UnitEntity unit = new UnitEntity();
        unit.setId(unitId);
        unit.setNumber("12");

        RoomEntity room = new RoomEntity();
        room.setId(UUID.randomUUID());
        room.setRoomType("living");
        room.setName("Гостиная");
        room.setRoomHeight(BigDecimal.valueOf(2.7));
        room.setIsMezzanine(true);
        room.setUnit(unit);

        when(unitJpaRepository.findById(eq(unitId))).thenReturn(Optional.of(unit));
        when(roomJpaRepository.findByUnit_IdIn(eq(List.of(unitId)))).thenReturn(List.of(room));

        Map<String, Object> result = registryUnitQueryService.loadUnitExplication(unitId);

        assertThat(result).isNotNull();
        assertThat(result).containsEntry("id", unitId);
        assertThat(result).containsKey("rooms");
        List<?> rooms = (List<?>) result.get("rooms");
        assertThat(rooms).hasSize(1);
        @SuppressWarnings("unchecked")
        Map<String, Object> first = (Map<String, Object>) rooms.getFirst();
        assertThat(first).containsEntry("type", "living");
        assertThat(first).containsEntry("label", "Гостиная");
        assertThat(first).containsEntry("isMezzanine", true);
    }
}