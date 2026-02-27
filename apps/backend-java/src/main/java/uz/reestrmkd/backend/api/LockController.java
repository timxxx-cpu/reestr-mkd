package uz.reestrmkd.backend.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.application.LockService;
import uz.reestrmkd.backend.security.PolicyService;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}/locks")
public class LockController {
    private final LockService service;
    private final PolicyService policy;

    public LockController(LockService service, PolicyService policy) {
        this.service = service;
        this.policy = policy;
    }

    @GetMapping
    public Map<String, Object> getLock(@PathVariable String applicationId) {
        return service.get(applicationId);
    }

    @PostMapping("/acquire")
    public Map<String, Object> acquire(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "mutate", "Role cannot mutate workflow");
        Integer ttl = body == null ? null : (body.get("ttlSeconds") instanceof Number n ? n.intValue() : null);
        return service.acquire(applicationId, actor.userId(), actor.userRole(), ttl);
    }

    @PostMapping("/refresh")
    public Map<String, Object> refresh(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "mutate", "Role cannot mutate workflow");
        Integer ttl = body == null ? null : (body.get("ttlSeconds") instanceof Number n ? n.intValue() : null);
        return service.refresh(applicationId, actor.userId(), ttl);
    }

    @PostMapping("/release")
    public Map<String, Object> release(@PathVariable String applicationId) {
        var actor = policy.require("workflow", "mutate", "Role cannot mutate workflow");
        return service.release(applicationId, actor.userId());
    }
}
