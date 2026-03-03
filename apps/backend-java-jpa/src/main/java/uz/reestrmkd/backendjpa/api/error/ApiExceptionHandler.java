package uz.reestrmkd.backendjpa.api.error;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiErrorException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiErrorException ex, HttpServletRequest request) {
        return ResponseEntity.status(ex.getStatus()).body(payload(ex.getCode(), ex.getMessage(), ex.getDetails(), request));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> handleStatus(ResponseStatusException ex, HttpServletRequest request) {
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        String reason = ex.getReason() == null ? status.getReasonPhrase() : ex.getReason();
        String code = normalizeCode(reason, status);
        return ResponseEntity.status(status).body(payload(code, reason, null, request));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex, HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(payload("INTERNAL_ERROR", "Internal server error", null, request));
    }

    private Map<String, Object> payload(String code, String message, Object details, HttpServletRequest request) {
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank()) requestId = UUID.randomUUID().toString();
        var payload = new java.util.LinkedHashMap<String, Object>();
        payload.put("code", code);
        payload.put("message", message);
        payload.put("details", details);
        payload.put("requestId", requestId);
        payload.put("timestamp", Instant.now().toString());
        return payload;
    }

    private String normalizeCode(String reason, HttpStatus status) {
        if (reason != null && reason.matches("[A-Z0-9_]+")) return reason;
        return status.name().toUpperCase(Locale.ROOT);
    }
}
