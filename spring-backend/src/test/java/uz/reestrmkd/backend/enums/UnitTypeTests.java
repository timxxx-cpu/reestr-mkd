package uz.reestrmkd.backend.enums;

import org.junit.jupiter.api.Test;

import uz.reestrmkd.backend.domain.registry.model.UnitType;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class UnitTypeTests {

    @Test
    void shouldResolveSupportedValues() {
        assertEquals(UnitType.FLAT, UnitType.fromValue("flat"));
        assertEquals(UnitType.OFFICE, UnitType.fromValue("office"));
        assertEquals(UnitType.DUPLEX_UP, UnitType.fromValue("duplex_up"));
        assertEquals(UnitType.DUPLEX_DOWN, UnitType.fromValue("duplex_down"));
        assertEquals(UnitType.PANTRY, UnitType.fromValue("pantry"));
    }

    @Test
    void shouldRejectUnsupportedValue() {
        assertThrows(IllegalArgumentException.class, () -> UnitType.fromValue("parking_place"));
    }
}
