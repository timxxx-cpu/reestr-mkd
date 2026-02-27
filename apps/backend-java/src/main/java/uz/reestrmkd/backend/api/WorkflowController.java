package uz.reestrmkd.backend.api;

import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.application.WorkflowService;
import uz.reestrmkd.backend.security.PolicyService;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/applications/{applicationId}/workflow")
public class WorkflowController {
    private final WorkflowService service;
    private final PolicyService policy;

    public WorkflowController(WorkflowService service, PolicyService policy) {
        this.service = service;
        this.policy = policy;
    }

    @PostMapping("/complete-step")
    public Map<String, Object> complete(@PathVariable String applicationId, @RequestBody Map<String, Object> body) {
        var actor = policy.require("workflow", "mutate", "Role cannot mutate workflow");
        int stepIndex = body.get("stepIndex") instanceof Number n ? n.intValue() : -1;
        String comment = body.get("comment") == null ? null : String.valueOf(body.get("comment"));
        return service.completeStep(applicationId, actor.userId(), stepIndex, comment);
    }

    @PostMapping("/review-approve")
    public Map<String, Object> reviewApprove(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "mutate", "Role cannot mutate workflow");
        String comment = body == null || body.get("comment") == null ? null : String.valueOf(body.get("comment"));
        return service.reviewApprove(applicationId, actor.userId(), comment);
    }

    @PostMapping("/review-reject")
    public Map<String, Object> reviewReject(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "mutate", "Role cannot mutate workflow");
        String comment = body == null || body.get("comment") == null ? null : String.valueOf(body.get("comment"));
        return service.reviewReject(applicationId, actor.userId(), comment);
    }

    @PostMapping("/rollback-step")
    public Map<String, Object> rollback(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "mutate", "Role cannot mutate workflow");
        String reason = body == null || body.get("reason") == null ? null : String.valueOf(body.get("reason"));
        return service.rollbackStep(applicationId, actor.userId(), reason);
    }

    @PostMapping("/assign-technician")
    public Map<String, Object> assign(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        policy.require("workflow", "assignTechnician", "Role cannot assign technician");
        return Map.of("code", "NOT_IMPLEMENTED", "message", "assign-technician will be implemented in next step");
    }

    @PostMapping("/request-decline")
    public Map<String, Object> requestDecline(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "requestDecline", "Role cannot request decline");
        String reason = body == null || body.get("reason") == null ? null : String.valueOf(body.get("reason"));
        Integer stepIndex = body != null && body.get("stepIndex") instanceof Number n ? n.intValue() : null;
        return service.requestDecline(applicationId, actor.userId(), reason, stepIndex);
    }

    @PostMapping("/decline")
    public Map<String, Object> decline(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "decline", "Role cannot decline application");
        String reason = body == null || body.get("reason") == null ? null : String.valueOf(body.get("reason"));
        return service.decline(applicationId, actor.userId(), actor.userRole(), reason);
    }

    @PostMapping("/return-from-decline")
    public Map<String, Object> returnFromDecline(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "returnFromDecline", "Only admin or branch_manager can return from decline");
        String comment = body == null || body.get("comment") == null ? null : String.valueOf(body.get("comment"));
        return service.returnFromDecline(applicationId, actor.userId(), comment);
    }

    @PostMapping("/restore")
    public Map<String, Object> restore(@PathVariable String applicationId, @RequestBody(required = false) Map<String, Object> body) {
        var actor = policy.require("workflow", "restore", "Only admin can restore application");
        String comment = body == null || body.get("comment") == null ? null : String.valueOf(body.get("comment"));
        return service.restore(applicationId, actor.userId(), comment);
    }
}
