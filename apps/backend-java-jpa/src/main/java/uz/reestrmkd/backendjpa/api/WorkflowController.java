package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.JpaFacadeService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/applications/{applicationId}/workflow")
public class WorkflowController {
    private final JpaFacadeService facade;

    @PostMapping("/complete-step") public Map<String, Object> complete(@PathVariable String applicationId, @RequestBody Map<String,Object> body){ return facade.updateApplicationWorkflow(applicationId, "IN_PROGRESS", "DRAFT"); }
    @PostMapping("/review-approve") public Map<String, Object> reviewApprove(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.updateApplicationWorkflow(applicationId, "IN_PROGRESS", "DRAFT"); }
    @PostMapping("/review-reject") public Map<String, Object> reviewReject(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.updateApplicationWorkflow(applicationId, "IN_PROGRESS", "REVISION"); }
    @PostMapping("/rollback-step") public Map<String, Object> rollback(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.updateApplicationWorkflow(applicationId, "IN_PROGRESS", "DRAFT"); }
    @PostMapping("/assign-technician") public Map<String, Object> assign(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.ok(); }
    @PostMapping("/request-decline") public Map<String, Object> requestDecline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.updateApplicationWorkflow(applicationId, "IN_PROGRESS", "PENDING_DECLINE"); }
    @PostMapping("/decline") public Map<String, Object> decline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.updateApplicationWorkflow(applicationId, "DECLINED", "DECLINED_BY_ADMIN"); }
    @PostMapping("/return-from-decline") public Map<String, Object> returnFromDecline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.updateApplicationWorkflow(applicationId, "IN_PROGRESS", "RETURNED_BY_MANAGER"); }
    @PostMapping("/restore") public Map<String, Object> restore(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return facade.updateApplicationWorkflow(applicationId, "IN_PROGRESS", "DRAFT"); }
}
