package uz.reestr.mkd.backendjpa.idempotency;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class IdempotencyStoreService {

  private static final long DEFAULT_TTL_MS = 5 * 60 * 1000L;
  private static final int DEFAULT_MAX_ENTRIES = 2000;

  private final Map<String, IdempotencyCacheEntry> cache = new ConcurrentHashMap<>();

  public LookupResult get(String key, String fingerprint) {
    IdempotencyCacheEntry entry = cache.get(key);
    if (entry == null) {
      return LookupResult.miss();
    }

    if (entry.expiresAt() <= System.currentTimeMillis()) {
      cache.remove(key);
      return LookupResult.miss();
    }

    if (fingerprint != null && !fingerprint.equals(entry.fingerprint())) {
      return LookupResult.conflict();
    }

    return LookupResult.hit(entry);
  }

  public void set(String key, String fingerprint, int status, String contentType, byte[] body) {
    cleanup();
    long now = System.currentTimeMillis();
    cache.put(key, new IdempotencyCacheEntry(
        fingerprint,
        status,
        contentType,
        body,
        now,
        now + DEFAULT_TTL_MS
    ));
  }

  private void cleanup() {
    long now = System.currentTimeMillis();
    cache.entrySet().removeIf(e -> e.getValue().expiresAt() <= now);

    if (cache.size() <= DEFAULT_MAX_ENTRIES) {
      return;
    }

    List<Map.Entry<String, IdempotencyCacheEntry>> sorted = new ArrayList<>(cache.entrySet());
    sorted.sort(Comparator.comparingLong(e -> e.getValue().createdAt()));
    int overflow = cache.size() - DEFAULT_MAX_ENTRIES;
    for (int i = 0; i < overflow; i++) {
      cache.remove(sorted.get(i).getKey());
    }
  }

  public record LookupResult(String status, IdempotencyCacheEntry entry) {

    public static LookupResult miss() {
      return new LookupResult("miss", null);
    }

    public static LookupResult conflict() {
      return new LookupResult("conflict", null);
    }

    public static LookupResult hit(IdempotencyCacheEntry entry) {
      return new LookupResult("hit", entry);
    }
  }
}
