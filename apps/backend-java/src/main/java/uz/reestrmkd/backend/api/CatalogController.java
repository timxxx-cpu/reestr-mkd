package uz.reestrmkd.backend.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.application.CatalogService;
import uz.reestrmkd.backend.security.PolicyService;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/catalogs")
public class CatalogController {
    private final CatalogService service;
    private final PolicyService policy;

    public CatalogController(CatalogService service, PolicyService policy) {
        this.service = service;
        this.policy = policy;
    }

    @GetMapping("/{table}")
    public List<Map<String, Object>> getCatalog(@PathVariable String table, @RequestParam(required = false) String activeOnly) {
        return service.list(table, "true".equals(activeOnly));
    }

    @PostMapping("/{table}/upsert")
    public Map<String, Object> upsertCatalog(@PathVariable String table, @RequestBody Map<String, Object> body) {
        policy.require("catalogs", "mutate", "Role cannot mutate catalogs");
        Map<String, Object> item = body == null ? null : (Map<String, Object>) body.get("item");
        return service.upsert(table, item);
    }

    @PutMapping("/{table}/{id}/active")
    public Map<String, Object> setActive(@PathVariable String table, @PathVariable String id, @RequestBody Map<String, Object> body) {
        policy.require("catalogs", "mutate", "Role cannot mutate catalogs");
        Boolean isActive = body == null ? null : (body.get("isActive") instanceof Boolean b ? b : null);
        return service.setActive(table, id, isActive);
    }
}
