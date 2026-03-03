package uz.reestrmkd.backendjpa.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.security.PolicyService;
import uz.reestrmkd.backendjpa.service.VersioningJpaService;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/versions")
public class VersioningController {
    private final VersioningJpaService versions;
    private final PolicyService policy;

    public VersioningController(VersioningJpaService versions, PolicyService policy) {
        this.versions = versions;
        this.policy = policy;
    }

    @GetMapping
    public Object list(@RequestParam(required = false) String entityType, @RequestParam(required = false) String entityId) {
        return versions.list(entityType, entityId);
    }

    @PostMapping
    public Map<String, Object> create(
            @RequestBody(required = false) Map<String, Object> body,
            org.springframework.security.core.Authentication authentication
    ) {
        var actor = policy.require(authentication, "versioning", "create", "Role cannot create versions");
        return versions.create(withActor(body, "createdBy", actor.userId()));
    }

    @PostMapping("/{versionId}/approve")
    public Map<String, Object> approve(
            @PathVariable String versionId,
            @RequestBody(required = false) Map<String, Object> body,
            org.springframework.security.core.Authentication authentication
    ) {
        var actor = policy.require(authentication, "versioning", "approve", "Role cannot approve versions");
        return versions.approve(versionId, withActor(body, "approvedBy", actor.userId()));
    }

    @PostMapping("/{versionId}/decline")
    public Map<String, Object> decline(
            @PathVariable String versionId,
            @RequestBody(required = false) Map<String, Object> body,
            org.springframework.security.core.Authentication authentication
    ) {
        var actor = policy.require(authentication, "versioning", "decline", "Role cannot decline versions");
        return versions.decline(versionId, withActor(body, "declinedBy", actor.userId()));
    }

    @GetMapping("/{versionId}/snapshot")
    public Object snapshot(@PathVariable String versionId) { return versions.snapshot(versionId); }

    @PostMapping("/{versionId}/restore")
    public Map<String, Object> restore(@PathVariable String versionId, org.springframework.security.core.Authentication authentication) {
        policy.require(authentication, "versioning", "restore", "Role cannot restore versions");
        return versions.restore(versionId);
    }

    private Map<String, Object> withActor(Map<String, Object> body, String actorField, String actorUserId) {
        Map<String, Object> payload = body == null ? new LinkedHashMap<>() : new LinkedHashMap<>(body);
        Object current = payload.get(actorField);
        if (current == null || String.valueOf(current).isBlank()) {
            payload.put(actorField, actorUserId);
        }
        return payload;
    }
}
