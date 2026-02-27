package uz.reestrmkd.backend.api;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestrmkd.backend.application.BackendPortingService;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ops")
public class OpsController {
    private final BackendPortingService service;

    public OpsController(BackendPortingService service) {
        this.service = service;
    }

    @GetMapping("/db-ping")
    public Map<String, Object> dbPing() {
        return service.pingDatabase();
    }
}
