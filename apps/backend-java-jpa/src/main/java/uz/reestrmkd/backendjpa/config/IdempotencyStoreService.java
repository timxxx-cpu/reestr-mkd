package uz.reestrmkd.backendjpa.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class IdempotencyStoreService {
    private final Map<String, Entry> store = new ConcurrentHashMap<>();
    private final long ttlMs;
    private final int maxEntries;

    @Autowired
    public IdempotencyStoreService(
        @Value("${app.idempotency.ttl-ms:300000}") long ttlMs,
        @Value("${app.idempotency.max-entries:2000}") int maxEntries
    ) {
        this.ttlMs = Math.max(1_000, ttlMs);
        this.maxEntries = Math.max(100, maxEntries);
    }


    // Compatibility constructor for direct usage in tests/tools without Spring value injection
    public IdempotencyStoreService(int ttlMs, int maxEntries) {
        this((long) ttlMs, maxEntries);
    }

    public Entry get(String key, String fingerprint) {
        Entry entry = store.get(key);
        if (entry == null) return null;
        if (entry.expiresAt() <= System.currentTimeMillis()) {
            store.remove(key);
            return null;
        }
        if (!entry.fingerprint().equals(fingerprint)) {
            return Entry.conflictMarker();
        }
        return entry;
    }

    public void put(String key, String fingerprint, int status, String contentType, byte[] body) {
        cleanup();
        long now = System.currentTimeMillis();
        store.put(key, new Entry(fingerprint, status, contentType, body, now, now + ttlMs, false));
    }


    // Backward-compatible API used by older tests/tooling
    public Entry get(String key) {
        Entry entry = store.get(key);
        if (entry == null) return null;
        if (entry.expiresAt() <= System.currentTimeMillis()) {
            store.remove(key);
            return null;
        }
        return entry;
    }

    // Backward-compatible API used by older tests/tooling
    public void put(String key, Entry entry) {
        if (entry == null) return;
        cleanup();
        long now = System.currentTimeMillis();
        long expiresAt = entry.expiresAt() > now ? entry.expiresAt() : now + ttlMs;
        store.put(key, new Entry(entry.fingerprint(), entry.status(), entry.contentType(), entry.body(), now, expiresAt, entry.conflictFlag()));
    }

    private void cleanup() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(e -> e.getValue().expiresAt() <= now);
        if (store.size() <= maxEntries) return;

        store.entrySet().stream()
            .sorted(Comparator.comparingLong(e -> e.getValue().createdAt()))
            .limit(store.size() - maxEntries)
            .map(Map.Entry::getKey)
            .toList()
            .forEach(store::remove);
    }

    public record Entry(String fingerprint, int status, String contentType, byte[] body, long createdAt, long expiresAt, boolean conflictFlag) {
        // Backward-compatible 4-arg constructor used by older call-sites/tests
        public Entry(String fingerprint, int status, String contentType, byte[] body) {
            this(fingerprint, status, contentType, body, System.currentTimeMillis(), 0L, false);
        }

        public static Entry conflictMarker() {
            return new Entry("", 0, null, new byte[0], 0, 0, true);
        }
    }
}