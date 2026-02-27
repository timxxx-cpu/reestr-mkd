package uz.reestrmkd.backend.common;

public record ApiError(String code, String message, Object details, String requestId) {}
