package uz.reestrmkd.backendjpa.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class IdempotencyStoreServiceTest {

    @Test
    void returns_conflict_when_same_key_with_different_fingerprint() {
        IdempotencyStoreService store = new IdempotencyStoreService(300_000, 2000);
        store.put("k1", "fp1", 200, "application/json", "{}".getBytes());

        IdempotencyStoreService.Entry entry = store.get("k1", "fp2");

        assertNotNull(entry);
        assertTrue(entry.conflictFlag());
    }

    @Test
    void expires_entries_by_ttl() throws Exception {
        IdempotencyStoreService store = new IdempotencyStoreService(1000, 2000);
        store.put("k1", "fp1", 200, "application/json", "{}".getBytes());

        Thread.sleep(1100);

        assertNull(store.get("k1", "fp1"));
    }
}