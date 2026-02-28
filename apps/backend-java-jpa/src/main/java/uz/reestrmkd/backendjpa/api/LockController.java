package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.LockJpaService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/applications/{applicationId}/locks")
public class LockController {
    private final LockJpaService service;

    @GetMapping public Map<String, Object> get(@PathVariable String applicationId){ return service.get(applicationId); }
    @PostMapping("/acquire")
    public Map<String, Object> acquire(
            @PathVariable String applicationId,
            @RequestBody(required=false) Map<String,Object> body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId,
            @RequestHeader(value = "X-User-Role", required = false) String headerUserRole
    ){
        Integer ttl = body == null ? null : (body.get("ttlSeconds") instanceof Number n ? n.intValue() : null);
        String userId = headerUserId == null || headerUserId.isBlank() ? "system" : headerUserId;
        String role = headerUserRole == null || headerUserRole.isBlank() ? "unknown" : headerUserRole;
        return service.acquire(applicationId, userId, role, ttl);
    }
    @PostMapping("/refresh")
    public Map<String, Object> refresh(
            @PathVariable String applicationId,
            @RequestBody(required=false) Map<String,Object> body,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId
    ){
        Integer ttl = body == null ? null : (body.get("ttlSeconds") instanceof Number n ? n.intValue() : null);
        String userId = headerUserId == null || headerUserId.isBlank() ? "system" : headerUserId;
        return service.refresh(applicationId, userId, ttl);
    }
    @PostMapping("/release")
    public Map<String, Object> release(
            @PathVariable String applicationId,
            @RequestHeader(value = "X-User-Id", required = false) String headerUserId
    ){
        String userId = headerUserId == null || headerUserId.isBlank() ? "system" : headerUserId;
        return service.release(applicationId, userId);
    }
}
