package uz.reestrmkd.backendjpa.config;

import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class IdempotencyStoreService {
    private final Map<String, Entry> store = new ConcurrentHashMap<>();

    public Entry get(String key) {
        return store.get(key);
    }

    public void put(String key, Entry entry) {
        store.put(key, entry);
    }

    public record Entry(String fingerprint, int status, String contentType, byte[] body) {}
}
