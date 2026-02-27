package uz.reestrmkd.backend.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.application.VersioningService;
import uz.reestrmkd.backend.security.PolicyService;
import uz.reestrmkd.backend.security.RequestContextHolder;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/versions")
public class VersioningController {
    private final VersioningService versions;
    private final PolicyService policy;

    public VersioningController(VersioningService versions, PolicyService policy) { this.versions = versions; this.policy = policy; }

    @GetMapping public Object versions(@RequestParam Map<String,String> q) { return versions.list(q.get("entityType"), q.get("entityId")); }
    @PostMapping public Map<String, Object> create(@RequestBody Map<String,Object> body) { policy.require("versioning", "create", "Role cannot create versions"); return versions.create(body); }
    @PostMapping("/{versionId}/approve") public Map<String, Object> approve(@PathVariable String versionId, @RequestBody(required = false) Map<String,Object> body) { policy.require("versioning", "approve", "Role cannot approve versions"); var a = RequestContextHolder.get(); return versions.approve(versionId, a == null ? "system" : a.userId()); }
    @PostMapping("/{versionId}/decline") public Map<String, Object> decline(@PathVariable String versionId, @RequestBody(required = false) Map<String,Object> body) { policy.require("versioning", "decline", "Role cannot decline versions"); var a = RequestContextHolder.get(); String reason = body == null ? null : (body.get("reason") == null ? null : String.valueOf(body.get("reason"))); return versions.decline(versionId, a == null ? "system" : a.userId(), reason); }
    @GetMapping("/{versionId}/snapshot") public Map<String, Object> snapshot(@PathVariable String versionId) { return versions.snapshot(versionId); }
    @PostMapping("/{versionId}/restore") public Map<String, Object> restore(@PathVariable String versionId, @RequestBody(required = false) Map<String,Object> body) { policy.require("versioning", "restore", "Role cannot restore versions"); var a = RequestContextHolder.get(); return versions.restore(versionId, a == null ? "system" : a.userId()); }
}
