package uz.reestrmkd.backend.domain.project.api;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uz.reestrmkd.backend.domain.common.api.ItemsResponseDto;
import uz.reestrmkd.backend.domain.common.api.MapPayloadDto;
import uz.reestrmkd.backend.domain.common.api.MapResponseDto;
import uz.reestrmkd.backend.domain.common.api.PagedItemsResponseDto;
import uz.reestrmkd.backend.domain.project.service.ProjectApplicationQueryService;
import uz.reestrmkd.backend.domain.project.service.ProjectCreationService;
import uz.reestrmkd.backend.domain.project.service.ProjectListQueryService;
import uz.reestrmkd.backend.domain.project.service.ProjectMapOverviewService;
import uz.reestrmkd.backend.domain.project.service.ProjectTepSummaryService;
import uz.reestrmkd.backend.domain.registry.api.TepSummaryResponseDto;
import uz.reestrmkd.backend.domain.registry.api.ValidationStepRequestDto;
import uz.reestrmkd.backend.domain.registry.service.RegistryValidationService;
import uz.reestrmkd.backend.domain.registry.service.ValidationUtils;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.security.CurrentUser;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ProjectController {

    private final RegistryValidationService registryValidationService;
    private final ProjectCreationService projectCreationService;
    private final ProjectApplicationQueryService projectApplicationQueryService;
    private final ProjectListQueryService projectListQueryService;
    private final ProjectMapOverviewService projectMapOverviewService;
    private final ProjectTepSummaryService projectTepSummaryService;

    public ProjectController(
        RegistryValidationService registryValidationService,
        ProjectCreationService projectCreationService,
        ProjectApplicationQueryService projectApplicationQueryService,
        ProjectListQueryService projectListQueryService,
        ProjectMapOverviewService projectMapOverviewService,
        ProjectTepSummaryService projectTepSummaryService
    ) {
        this.registryValidationService = registryValidationService;
        this.projectCreationService = projectCreationService;
        this.projectApplicationQueryService = projectApplicationQueryService;
        this.projectListQueryService = projectListQueryService;
        this.projectMapOverviewService = projectMapOverviewService;
        this.projectTepSummaryService = projectTepSummaryService;
    }

    @PostMapping("/projects/from-application")
    public MapResponseDto createFromApplication(
        @RequestBody(required = false) MapPayloadDto payload,
        @CurrentUser ActorPrincipal actor
    ) {
        return MapResponseDto.of(projectCreationService.createFromApplication(payload, actor));
    }

    @GetMapping("/projects")
    public PagedItemsResponseDto getProjects(
        @RequestParam(required = false) String scope,
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String workflowSubstatus,
        @RequestParam(required = false) String assignee,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer limit,
        @CurrentUser ActorPrincipal actor
    ) {
        return projectListQueryService.getProjects(scope, status, workflowSubstatus, assignee, search, page, limit, actor);
    }

    @GetMapping("/projects/{projectId}/tep-summary")
    public TepSummaryResponseDto getTepSummary(@PathVariable UUID projectId) {
        return projectTepSummaryService.getTepSummary(projectId);
    }

    @GetMapping("/projects/map-overview")
    public MapResponseDto mapOverview(@RequestParam(required = false) String scope) {
        return MapResponseDto.of(projectMapOverviewService.mapOverview(scope));
    }

    @GetMapping("/projects/summary-counts")
    public MapResponseDto summaryCounts(
        @RequestParam(required = false) String scope,
        @RequestParam(required = false) String assignee,
        @CurrentUser ActorPrincipal actor
    ) {
        return MapResponseDto.of(projectApplicationQueryService.summaryCounts(scope, assignee, actor));
    }

    @GetMapping("/external-applications")
    public ItemsResponseDto externalApplications(@RequestParam(required = false) String scope) {
        return new ItemsResponseDto(projectApplicationQueryService.externalApplications(scope));
    }

    @GetMapping("/projects/{projectId}/application-id")
    public MapResponseDto resolveApplicationId(@PathVariable UUID projectId, @RequestParam(required = false) String scope) {
        return MapResponseDto.of(Map.of("applicationId", projectApplicationQueryService.resolveApplicationId(projectId, scope)));
    }

    @PostMapping("/projects/{projectId}/validation/step")
    public MapResponseDto validateStep(@PathVariable UUID projectId, @Valid @RequestBody ValidationStepRequestDto body) {
        String stepId = body.stepId() == null ? "" : body.stepId();
        ValidationUtils.ValidationResult validationResult = registryValidationService.buildStepValidationResult(projectId, stepId);
        List<Map<String, Object>> errors = validationResult.errors().stream()
            .map(err -> Map.<String, Object>of("code", err.code(), "title", err.title(), "message", err.message()))
            .toList();

        return MapResponseDto.of(Map.of("ok", errors.isEmpty(), "stepId", body.stepId(), "errors", errors));
    }
}
