package uz.reestr.mkd.backendjpa.idempotency;

public record IdempotencyCacheEntry(
    String fingerprint,
    int status,
    String contentType,
    byte[] body,
    long createdAt,
    long expiresAt
) {
}
