package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestrmkd.backendjpa.service.JpaFacadeService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/ops")
public class OpsController {
    private final JpaFacadeService facade;

    @GetMapping("/db-ping")
    public Map<String,Object> ping(){ return facade.ok(); }
}
