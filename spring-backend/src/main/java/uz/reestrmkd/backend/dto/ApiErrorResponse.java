package uz.reestrmkd.backend.dto;

public record ApiErrorResponse(
    String message,
    String code,
    Object details,
    int status
) {
}
