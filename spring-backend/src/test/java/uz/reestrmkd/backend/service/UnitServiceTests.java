package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import uz.reestrmkd.backend.domain.common.service.UjIdentifierService;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.UnitService;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UnitServiceTests {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private UnitJpaRepository unitJpaRepository;

    @Mock
    private UjIdentifierService ujIdentifierService;

    @InjectMocks
    private UnitService unitService;

    @Test
    void shouldDefaultLegacyNullHasMezzanineToFalseOnPatchUpdate() {
        UUID unitId = UUID.randomUUID();
        UnitEntity existing = new UnitEntity();
        existing.setId(unitId);
        existing.setFloorId(UUID.randomUUID());
        existing.setUnitType("parking_place");
        existing.setHasMezzanine(null);

        when(unitJpaRepository.findById(unitId)).thenReturn(Optional.of(existing));
        when(unitJpaRepository.save(any(UnitEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UUID savedId = unitService.upsertUnit(Map.of(
            "id", unitId,
            "num", "-P1",
            "area", "13.25"
        ));

        assertThat(savedId).isEqualTo(unitId);
        assertThat(existing.getHasMezzanine()).isFalse();
        assertThat(existing.getNumber()).isEqualTo("-P1");
        assertThat(existing.getTotalArea()).isEqualByComparingTo(new BigDecimal("13.25"));
    }
}
