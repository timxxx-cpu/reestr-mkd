package uz.reestrmkd.backendjpa.api;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/ops")
public class OpsController {
    public Map<String,Object> ping(){ return Map.of("ok", true); }
}
