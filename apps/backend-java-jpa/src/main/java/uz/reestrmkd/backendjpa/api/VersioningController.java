package uz.reestrmkd.backendjpa.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.VersioningJpaService;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/versions")
public class VersioningController {
    private final VersioningJpaService versions;

    public VersioningController(VersioningJpaService versions) { this.versions = versions; }

    @GetMapping
    public Object list(@RequestParam(required = false) String entityType, @RequestParam(required = false) String entityId) {
        return versions.list(entityType, entityId);
    }

    @PostMapping
    public Map<String, Object> create(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId
    ) {
        return versions.create(withActor(body, "createdBy", headerUserId));
    }

    @PostMapping("/{versionId}/approve")
    public Map<String, Object> approve(
            @PathVariable String versionId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId
    ) {
        return versions.approve(versionId, withActor(body, "approvedBy", headerUserId));
    }

    @PostMapping("/{versionId}/decline")
    public Map<String, Object> decline(
            @PathVariable String versionId,
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId
    ) {
        return versions.decline(versionId, withActor(body, "declinedBy", headerUserId));
    }

    @GetMapping("/{versionId}/snapshot")
    public Object snapshot(@PathVariable String versionId) { return versions.snapshot(versionId); }

    @PostMapping("/{versionId}/restore")
    public Map<String, Object> restore(@PathVariable String versionId) {
        return versions.restore(versionId);
    }

    private Map<String, Object> withActor(Map<String, Object> body, String actorField, String headerUserId) {
        Map<String, Object> payload = body == null ? new LinkedHashMap<>() : new LinkedHashMap<>(body);
        Object current = payload.get(actorField);
        if (current == null || String.valueOf(current).isBlank()) {
            String actor = headerUserId == null || headerUserId.isBlank() ? "system" : headerUserId;
            payload.put(actorField, actor);
        }
        return payload;
    }
}
