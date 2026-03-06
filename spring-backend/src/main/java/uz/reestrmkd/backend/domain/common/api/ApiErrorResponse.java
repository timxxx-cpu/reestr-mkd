package uz.reestrmkd.backend.domain.common.api;

public record ApiErrorResponse(
    String code,
    String message,
    Object details,
    String requestId
) {
}
