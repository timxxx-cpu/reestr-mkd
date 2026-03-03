package uz.reestrmkd.backendjpa.api;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backendjpa.security.PolicyService;
import uz.reestrmkd.backendjpa.service.WorkflowJpaService;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/applications/{applicationId}/workflow")
public class WorkflowController {
    private final WorkflowJpaService workflow;
    private final PolicyService policy;

    @PostMapping("/complete-step")
    public Map<String, Object> complete(@PathVariable String applicationId, @RequestBody Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "mutate", "Role cannot mutate workflow");
        return workflow.completeStep(applicationId, body, actor.userId(), actor.userRole());
    }

    @PostMapping("/review-approve")
    public Map<String, Object> reviewApprove(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "mutate", "Role cannot mutate workflow");
        return workflow.reviewApprove(applicationId, body, actor.userId(), actor.userRole());
    }

    @PostMapping("/review-reject")
    public Map<String, Object> reviewReject(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "mutate", "Role cannot mutate workflow");
        return workflow.reviewReject(applicationId, body, actor.userId(), actor.userRole());
    }

    @PostMapping("/rollback-step")
    public Map<String, Object> rollback(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "mutate", "Role cannot mutate workflow");
        return workflow.rollbackStep(applicationId, body, actor.userId(), actor.userRole());
    }

    @PostMapping("/assign-technician")
    public Map<String, Object> assign(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "assignTechnician", "Only admin or branch_manager can assign technician");
        return workflow.assignTechnician(applicationId, body, actor.userId(), actor.userRole());
    }

    @PostMapping("/request-decline")
    public Map<String, Object> requestDecline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "requestDecline", "Role cannot request decline");
        return workflow.requestDecline(applicationId, body, actor.userId(), actor.userRole());
    }

    @PostMapping("/decline")
    public Map<String, Object> decline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "decline", "Role cannot decline application");
        return workflow.decline(applicationId, body, actor.userId(), actor.userRole());
    }

    @PostMapping("/return-from-decline")
    public Map<String, Object> returnFromDecline(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "returnFromDecline", "Only admin or branch_manager can return from decline");
        return workflow.returnFromDecline(applicationId, body, actor.userId(), actor.userRole());
    }

    @PostMapping("/restore")
    public Map<String, Object> restore(@PathVariable String applicationId, @RequestBody(required=false) Map<String,Object> body, Authentication authentication){
        var actor = policy.require(authentication, "workflow", "restore", "Only admin can restore application");
        return workflow.restore(applicationId, body, actor.userId(), actor.userRole());
    }
}
