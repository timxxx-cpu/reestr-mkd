package uz.reestrmkd.backend.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import uz.reestrmkd.backend.domain.common.api.ApiErrorResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        return ResponseEntity.status(ex.getStatus())
            .body(new ApiErrorResponse(ex.getCode(), ex.getMessage(), ex.getDetails(), resolveRequestId(request)));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> fieldErrors.put(error.getField(), error.getDefaultMessage()));
        int status = HttpStatus.BAD_REQUEST.value();
        return ResponseEntity.status(status)
            .body(new ApiErrorResponse("VALIDATION_ERROR", "Validation failed", fieldErrors, resolveRequestId(request)));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        int status = HttpStatus.BAD_REQUEST.value();
        return ResponseEntity.status(status)
            .body(new ApiErrorResponse("VALIDATION_ERROR", "Validation failed", ex.getMessage(), resolveRequestId(request)));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleAnyException(Exception ex, HttpServletRequest request) {
        int status = HttpStatus.INTERNAL_SERVER_ERROR.value();
        return ResponseEntity.status(status)
            .body(new ApiErrorResponse("INTERNAL_ERROR", ex.getMessage(), ex.getClass().getSimpleName(), resolveRequestId(request)));
    }

    private String resolveRequestId(HttpServletRequest request) {
        String headerValue = request.getHeader("X-Request-Id");
        return headerValue == null || headerValue.isBlank() ? UUID.randomUUID().toString() : headerValue;
    }
}
