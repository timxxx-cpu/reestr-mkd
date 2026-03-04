package uz.reestrmkd.backend.enums;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ProjectStatusTests {
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @Test
    void shouldSerializeToCyrillicValue() throws Exception {
        String json = objectMapper.writeValueAsString(ProjectStatus.READY);
        assertEquals("\"Готовый к вводу\"", json);
    }

    @Test
    void shouldDeserializeFromCyrillicValue() throws Exception {
        ProjectStatus status = objectMapper.readValue("\"Строящийся\"", ProjectStatus.class);
        assertEquals(ProjectStatus.BUILDING, status);
    }
}
