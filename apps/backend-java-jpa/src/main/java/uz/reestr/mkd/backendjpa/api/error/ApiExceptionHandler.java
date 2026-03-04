package uz.reestr.mkd.backendjpa.api.error;

import jakarta.persistence.EntityNotFoundException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler(WorkflowGuardException.class)
  public ResponseEntity<ApiErrorResponse> handleWorkflowGuard(WorkflowGuardException ex) {
    HttpStatus status = HttpStatus.resolve(ex.getStatus());
    HttpStatus resolved = status == null ? HttpStatus.BAD_REQUEST : status;
    return build(
        resolved,
        ex.getCode(),
        messageOrDefault(ex.getMessage(), resolved.getReasonPhrase()),
        ex.getDetails()
    );
  }

  @ExceptionHandler(StepValidationException.class)
  public ResponseEntity<ApiErrorResponse> handleStepValidation(StepValidationException ex) {
    HttpStatus resolved = ex.getStatus() == null ? HttpStatus.BAD_REQUEST : ex.getStatus();
    return build(
        resolved,
        "STEP_VALIDATION_FAILED",
        "Шаг нельзя завершить: данные заполнены не полностью или с ошибками.",
        ex.getErrors()
    );
  }

  @ExceptionHandler(EntityNotFoundException.class)
  public ResponseEntity<ApiErrorResponse> handleEntityNotFound(EntityNotFoundException ex) {
    return build(
        HttpStatus.NOT_FOUND,
        "ENTITY_NOT_FOUND",
        messageOrDefault(ex.getMessage(), "Entity not found"),
        null
    );
  }

  @ExceptionHandler(IllegalArgumentException.class)
  public ResponseEntity<ApiErrorResponse> handleIllegalArgument(IllegalArgumentException ex) {
    return build(
        HttpStatus.BAD_REQUEST,
        "BAD_REQUEST",
        messageOrDefault(ex.getMessage(), "Invalid request"),
        null
    );
  }

  @ExceptionHandler(AccessDeniedException.class)
  public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException ex) {
    return build(
        HttpStatus.FORBIDDEN,
        "FORBIDDEN",
        messageOrDefault(ex.getMessage(), "Access denied"),
        null
    );
  }

  @ExceptionHandler(ResponseStatusException.class)
  public ResponseEntity<ApiErrorResponse> handleResponseStatus(ResponseStatusException ex) {
    HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
    HttpStatus resolved = status == null ? HttpStatus.INTERNAL_SERVER_ERROR : status;
    return build(
        resolved,
        defaultCodeForStatus(resolved),
        messageOrDefault(ex.getReason(), resolved.getReasonPhrase()),
        Map.of("status", ex.getStatusCode().value())
    );
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiErrorResponse> handleUnhandled(Exception ex) {
    return build(
        HttpStatus.INTERNAL_SERVER_ERROR,
        "INTERNAL_ERROR",
        "Unexpected server error",
        null
    );
  }

  private ResponseEntity<ApiErrorResponse> build(HttpStatus status, String code, String message, Object details) {
    return ResponseEntity
        .status(status)
        .body(new ApiErrorResponse(message, code, details));
  }

  private String defaultCodeForStatus(HttpStatus status) {
    return switch (status) {
      case BAD_REQUEST -> "BAD_REQUEST";
      case NOT_FOUND -> "NOT_FOUND";
      case FORBIDDEN -> "FORBIDDEN";
      case CONFLICT -> "CONFLICT";
      case UNAUTHORIZED -> "UNAUTHORIZED";
      default -> "INTERNAL_ERROR";
    };
  }

  private String messageOrDefault(String value, String fallback) {
    if (value == null || value.isBlank()) {
      return fallback;
    }
    return value;
  }

  public record ApiErrorResponse(String message, String code, Object details) {
  }
}
