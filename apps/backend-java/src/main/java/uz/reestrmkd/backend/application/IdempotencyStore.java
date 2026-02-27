package uz.reestrmkd.backend.application;

import org.springframework.stereotype.Component;
import uz.reestrmkd.backend.config.AppProperties;

import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class IdempotencyStore {
    public record Entry(String fingerprint, Object value, long createdAt, long expiresAt) {}
    private final Map<String, Entry> cache = new ConcurrentHashMap<>();
    private final long ttlMs;
    private final int maxEntries;

    public IdempotencyStore(AppProperties props) {
        this.ttlMs = props.getIdempotency().getTtlMs();
        this.maxEntries = props.getIdempotency().getMaxEntries();
    }

    public synchronized Entry get(String key) {
        Entry e = cache.get(key);
        if (e == null) return null;
        if (e.expiresAt() <= System.currentTimeMillis()) {
            cache.remove(key);
            return null;
        }
        return e;
    }

    public synchronized void set(String key, String fingerprint, Object value) {
        cleanup();
        long now = System.currentTimeMillis();
        cache.put(key, new Entry(fingerprint, value, now, now + ttlMs));
    }

    private void cleanup() {
        long now = System.currentTimeMillis();
        cache.entrySet().removeIf(e -> e.getValue().expiresAt() <= now);
        if (cache.size() <= maxEntries) return;
        cache.entrySet().stream()
            .sorted(Comparator.comparingLong(v -> v.getValue().createdAt()))
            .limit(cache.size() - maxEntries)
            .map(Map.Entry::getKey)
            .toList()
            .forEach(cache::remove);
    }
}
