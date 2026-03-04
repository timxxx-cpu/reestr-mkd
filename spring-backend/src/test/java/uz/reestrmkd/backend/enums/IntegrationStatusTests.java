package uz.reestrmkd.backend.enums;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class IntegrationStatusTests {

    @Test
    void shouldParseAllFrontendStatuses() {
        assertEquals(IntegrationStatus.IDLE, IntegrationStatus.fromValue("IDLE"));
        assertEquals(IntegrationStatus.SENDING, IntegrationStatus.fromValue("SENDING"));
        assertEquals(IntegrationStatus.WAITING, IntegrationStatus.fromValue("WAITING"));
        assertEquals(IntegrationStatus.COMPLETED, IntegrationStatus.fromValue("COMPLETED"));
        assertEquals(IntegrationStatus.ERROR, IntegrationStatus.fromValue("ERROR"));
    }

    @Test
    void shouldRejectUnknownStatus() {
        assertThrows(IllegalArgumentException.class, () -> IntegrationStatus.fromValue("PENDING"));
    }
}
