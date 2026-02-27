package uz.reestrmkd.backendjpa.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.VersioningJpaService;

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
    public Map<String, Object> create(@RequestBody Map<String, Object> body) { return versions.create(body); }
}
