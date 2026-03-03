package uz.reestrmkd.backendjpa.api;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
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
            Authentication authentication
    ){
        Integer ttl = body == null ? null : (body.get("ttlSeconds") instanceof Number n ? n.intValue() : null);
        String userId = authUser(authentication);
        String role = authRole(authentication);
        return service.acquire(applicationId, userId, role, ttl);
    }

    @PostMapping("/refresh")
    public Map<String, Object> refresh(
            @PathVariable String applicationId,
            @RequestBody(required=false) Map<String,Object> body,
            Authentication authentication
    ){
        Integer ttl = body == null ? null : (body.get("ttlSeconds") instanceof Number n ? n.intValue() : null);
        String userId = authUser(authentication);
        return service.refresh(applicationId, userId, ttl);
    }

    @PostMapping("/release")
     public ResponseEntity<Map<String, Object>> release(
            @PathVariable String applicationId,
   Authentication authentication,
            HttpServletRequest request
    ){
        if (request.getContentType() != null
            && request.getContentType().toLowerCase().contains("application/json")
            && request.getContentLengthLong() == 0) {
            Map<String, Object> body = new java.util.LinkedHashMap<>();
            body.put("statusCode", 400);
            body.put("code", "FST_ERR_CTP_EMPTY_JSON_BODY");
            body.put("error", "Bad Request");
            body.put("message", "Body cannot be empty when content-type is set to 'application/json'");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
        }

        String userId = authUser(authentication);
        return ResponseEntity.ok(service.release(applicationId, userId));
    }

    private String authUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED");
        }
        return authentication.getName();
    }

    private String authRole(Authentication authentication) {
        if (authentication == null || authentication.getAuthorities() == null || authentication.getAuthorities().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN");
        }
        String authority = authentication.getAuthorities().iterator().next().getAuthority();
        if (authority == null || authority.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "FORBIDDEN");
        }
        return authority.startsWith("ROLE_") ? authority.substring(5).toLowerCase() : authority.toLowerCase();
    }
}
