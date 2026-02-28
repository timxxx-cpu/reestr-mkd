package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.service.WorkflowJpaService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/applications/{applicationId}/workflow")
public class WorkflowController {
    private final WorkflowJpaService workflow;

    @PostMapping("/complete-step") public Map<String, Object> complete(@PathVariable String applicationId, @RequestBody Map<String,Object> body){ return workflow.completeStep(applicationId, body); }
    @PostMapping("/review-approve") public Map<String, Object> reviewApprove(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return workflow.reviewApprove(applicationId, body); }
    @PostMapping("/review-reject") public Map<String, Object> reviewReject(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return workflow.reviewReject(applicationId, body); }
    @PostMapping("/rollback-step") public Map<String, Object> rollback(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return workflow.rollbackStep(applicationId, body); }
    @PostMapping("/assign-technician") public Map<String, Object> assign(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return workflow.assignTechnician(applicationId, body); }
    @PostMapping("/request-decline") public Map<String, Object> requestDecline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return workflow.requestDecline(applicationId, body); }
    @PostMapping("/decline") public Map<String, Object> decline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return workflow.decline(applicationId, body); }
    @PostMapping("/return-from-decline") public Map<String, Object> returnFromDecline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return workflow.returnFromDecline(applicationId, body); }
    @PostMapping("/restore") public Map<String, Object> restore(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body){ return workflow.restore(applicationId, body); }
}
