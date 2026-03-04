package uz.reestr.mkd.backendjpa.api.error;

import java.util.List;
import org.springframework.http.HttpStatus;

public class StepValidationException extends RuntimeException {

  private final HttpStatus status;
  private final List<String> errors;

  public StepValidationException(HttpStatus status, List<String> errors) {
    super("Step validation failed");
    this.status = status == null ? HttpStatus.BAD_REQUEST : status;
    this.errors = errors == null ? List.of() : List.copyOf(errors);
  }

  public HttpStatus getStatus() {
    return status;
  }

  public List<String> getErrors() {
    return errors;
  }
}
