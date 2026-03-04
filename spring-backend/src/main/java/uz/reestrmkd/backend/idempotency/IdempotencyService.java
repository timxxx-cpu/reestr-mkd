package uz.reestrmkd.backend.idempotency;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class IdempotencyService {

    private final Cache<String, Entry> cache;

    public IdempotencyService(
        @Value("${app.idempotency.ttl-ms:300000}") long ttlMs,
        @Value("${app.idempotency.max-entries:2000}") long maxEntries
    ) {
        this.cache = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofMillis(ttlMs))
            .maximumSize(maxEntries)
            .build();
    }

    public IdempotencyState get(String key, String fingerprint) {
        Entry entry = cache.getIfPresent(key);
        if (entry == null) {
            return IdempotencyState.miss();
        }
        if (fingerprint != null && !fingerprint.equals(entry.fingerprint())) {
            return IdempotencyState.conflict();
        }
        return IdempotencyState.hit(entry.value());
    }

    public void set(String key, String fingerprint, Object value) {
        cache.put(key, new Entry(fingerprint, value));
    }

    private record Entry(String fingerprint, Object value) {
    }

    public record IdempotencyState(String status, Object value) {
        private static IdempotencyState miss() {
            return new IdempotencyState("miss", null);
        }

        private static IdempotencyState hit(Object value) {
            return new IdempotencyState("hit", value);
        }

        private static IdempotencyState conflict() {
            return new IdempotencyState("conflict", null);
        }
    }
}
