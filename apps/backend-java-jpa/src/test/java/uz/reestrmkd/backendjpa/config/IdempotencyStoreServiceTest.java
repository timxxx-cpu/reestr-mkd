package uz.reestrmkd.backendjpa.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class IdempotencyStoreServiceTest {

    @Test
    void stores_and_returns_entry() {
        IdempotencyStoreService service = new IdempotencyStoreService();
        var entry = new IdempotencyStoreService.Entry("fp-1", 200, "application/json", "{\"ok\":true}".getBytes());

        service.put("k-1", entry);

        var loaded = service.get("k-1");
        assertNotNull(loaded);
        assertEquals("fp-1", loaded.fingerprint());
        assertEquals(200, loaded.status());
    }
}
