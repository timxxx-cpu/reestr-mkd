package uz.reestrmkd.backend.dto;

public record ApiErrorResponse(
    String code,
    String message,
    Object details,
    String requestId
) {
}
