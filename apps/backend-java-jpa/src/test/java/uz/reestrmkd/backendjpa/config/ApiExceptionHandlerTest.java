package uz.reestrmkd.backendjpa.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import uz.reestrmkd.backendjpa.api.error.ApiExceptionHandler;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void handleStatus_returns_node_compatible_shape_without_timestamp() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/v1/projects");
        request.addHeader("X-Request-Id", "req-1");

        ResponseEntity<Map<String, Object>> response = handler.handleStatus(
            new ResponseStatusException(HttpStatus.BAD_REQUEST, "scope is required"),
            request
        );

        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        Map<String, Object> body = response.getBody();
        assertNotNull(body);
        assertEquals("MISSING_SCOPE", body.get("code"));
        assertEquals("scope is required", body.get("message"));
        assertEquals("req-1", body.get("requestId"));
        assertFalse(body.containsKey("timestamp"));
    }
}