package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.JpaFacadeService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/applications/{applicationId}/locks")
public class LockController {
    private final JpaFacadeService facade;

    @GetMapping public Map<String, Object> get(@PathVariable String applicationId){ return Map.of("locked", false); }
    @PostMapping("/acquire") public Map<String, Object> acquire(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/refresh") public Map<String, Object> refresh(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/release") public Map<String, Object> release(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.ok(); }
}
