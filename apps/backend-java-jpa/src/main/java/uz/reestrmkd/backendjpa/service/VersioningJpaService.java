package uz.reestrmkd.backendjpa.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backendjpa.domain.ObjectVersionEntity;
import uz.reestrmkd.backendjpa.repo.ObjectVersionRepository;

import java.util.Map;
import java.util.UUID;

@Service
public class VersioningJpaService {
    private final ObjectVersionRepository versions;

    public VersioningJpaService(ObjectVersionRepository versions) {
        this.versions = versions;
    }

    public Object list(String entityType, String entityId) {
        if (entityType != null && entityId != null) return versions.findByEntityTypeAndEntityIdOrderByIdDesc(entityType, entityId);
        return versions.findAll();
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> body) {
        ObjectVersionEntity v = new ObjectVersionEntity();
        try {
            var f = ObjectVersionEntity.class.getDeclaredField("id"); f.setAccessible(true); f.set(v, body.getOrDefault("id", UUID.randomUUID().toString()));
            f = ObjectVersionEntity.class.getDeclaredField("entityType"); f.setAccessible(true); f.set(v, body.get("entityType"));
            f = ObjectVersionEntity.class.getDeclaredField("entityId"); f.setAccessible(true); f.set(v, body.get("entityId"));
            f = ObjectVersionEntity.class.getDeclaredField("status"); f.setAccessible(true); f.set(v, body.getOrDefault("status", "PENDING"));
            f = ObjectVersionEntity.class.getDeclaredField("snapshotJson"); f.setAccessible(true); f.set(v, String.valueOf(body.getOrDefault("snapshot", "{}")));
        } catch (Exception e) { throw new RuntimeException(e); }
        versions.save(v);
        return Map.of("ok", true, "id", v.getId());
    }
}
