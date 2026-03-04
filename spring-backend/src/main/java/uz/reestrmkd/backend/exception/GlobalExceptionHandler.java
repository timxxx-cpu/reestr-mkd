package uz.reestrmkd.backend.exception;

import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import uz.reestrmkd.backend.dto.ApiErrorResponse;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex) {
        return ResponseEntity.status(ex.getStatus())
            .body(new ApiErrorResponse(ex.getMessage(), ex.getCode(), ex.getDetails(), ex.getStatus()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> fieldErrors.put(error.getField(), error.getDefaultMessage()));
        int status = HttpStatus.BAD_REQUEST.value();
        return ResponseEntity.status(status)
            .body(new ApiErrorResponse("Validation failed", "VALIDATION_ERROR", fieldErrors, status));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(ConstraintViolationException ex) {
        int status = HttpStatus.BAD_REQUEST.value();
        return ResponseEntity.status(status)
            .body(new ApiErrorResponse("Validation failed", "VALIDATION_ERROR", ex.getMessage(), status));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleAnyException(Exception ex) {
        int status = HttpStatus.INTERNAL_SERVER_ERROR.value();
        return ResponseEntity.status(status)
            .body(new ApiErrorResponse(ex.getMessage(), "INTERNAL_ERROR", ex.getClass().getSimpleName(), status));
    }
}
