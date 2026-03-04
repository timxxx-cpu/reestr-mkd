package uz.reestrmkd.backend.idempotency;

public record IdempotencyContext(
    String cacheKey,
    String fingerprint
) {
}
