package uz.reestr.mkd.backendjpa.api.error;

public class WorkflowGuardException extends RuntimeException {

  private final int status;
  private final String code;
  private final Object details;

  public WorkflowGuardException(int status, String code, String message) {
    this(status, code, message, null);
  }

  public WorkflowGuardException(int status, String code, String message, Object details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  public int getStatus() {
    return status;
  }

  public String getCode() {
    return code;
  }

  public Object getDetails() {
    return details;
  }
}
