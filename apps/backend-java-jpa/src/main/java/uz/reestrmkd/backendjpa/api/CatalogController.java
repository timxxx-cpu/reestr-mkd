package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.CatalogJpaService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/catalogs")
public class CatalogController {
    private final CatalogJpaService service;

    @GetMapping("/{table}")
    public Object list(@PathVariable String table, @RequestParam(required = false) String activeOnly) {
        return service.list(table, "true".equals(activeOnly));
    }

    @PostMapping("/{table}/upsert")
    public Map<String, Object> upsert(@PathVariable String table, @RequestBody Map<String,Object> body) {
        @SuppressWarnings("unchecked")
        Map<String, Object> item = body == null ? null : (Map<String, Object>) body.get("item");
        return service.upsert(table, item);
    }

    @PutMapping("/{table}/{id}/active")
    public Map<String, Object> active(@PathVariable String table, @PathVariable String id, @RequestBody Map<String,Object> body) {
        Boolean isActive = body == null ? null : (body.get("isActive") instanceof Boolean b ? b : null);
        return service.setActive(table, id, isActive);
    }
}
