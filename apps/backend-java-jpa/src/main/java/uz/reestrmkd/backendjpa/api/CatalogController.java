package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.JpaFacadeService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/catalogs")
public class CatalogController {
    private final JpaFacadeService facade;

    @GetMapping("/{table}")
    public Object list(@PathVariable String table) { return facade.nativeList(table, null, null); }
    @PostMapping("/{table}/upsert")
    public Map<String, Object> upsert(@PathVariable String table, @RequestBody Map<String,Object> body) { return facade.ok(); }
    @PutMapping("/{table}/{id}/active")
    public Map<String, Object> active(@PathVariable String table, @PathVariable String id, @RequestBody Map<String,Object> body) { return facade.ok(); }
}
