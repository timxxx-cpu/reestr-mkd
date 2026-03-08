package uz.reestrmkd.backend.domain.project.api;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import uz.reestrmkd.backend.domain.auth.service.SecurityPolicyService;
import uz.reestrmkd.backend.domain.common.api.ItemsResponseDto;
import uz.reestrmkd.backend.domain.common.api.MapPayloadDto;
import uz.reestrmkd.backend.domain.common.api.MapResponseDto;
import uz.reestrmkd.backend.domain.common.api.OkResponseDto;
import uz.reestrmkd.backend.domain.project.model.AddressEntity;
import uz.reestrmkd.backend.domain.project.model.DistrictEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectDocumentEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectEntity;
import uz.reestrmkd.backend.domain.project.model.ProjectParticipantEntity;
import uz.reestrmkd.backend.domain.project.model.RegionEntity;
import uz.reestrmkd.backend.domain.project.repository.ProjectDocumentJpaRepository;
import uz.reestrmkd.backend.domain.project.service.ProjectContextService;
import uz.reestrmkd.backend.domain.project.service.ProjectBuildingDetailsService;
import uz.reestrmkd.backend.domain.project.service.ProjectFullRegistryService;
import uz.reestrmkd.backend.domain.project.service.ProjectGeometryService;
import uz.reestrmkd.backend.domain.project.service.ProjectRegistryDetailsService;
import uz.reestrmkd.backend.domain.project.service.ProjectService;
import uz.reestrmkd.backend.domain.project.repository.AddressJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.DistrictJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.ProjectParticipantJpaRepository;
import uz.reestrmkd.backend.domain.project.repository.RegionJpaRepository;
import uz.reestrmkd.backend.domain.registry.api.BuildingDetailsSaveRequestDto;
import uz.reestrmkd.backend.domain.registry.api.GeometryCandidateImportItemDto;
import uz.reestrmkd.backend.domain.registry.api.GeometryCandidateResponseDto;
import uz.reestrmkd.backend.domain.registry.api.GeometryCandidatesImportRequestDto;
import uz.reestrmkd.backend.domain.registry.service.VersionService;
import uz.reestrmkd.backend.domain.workflow.service.ApplicationRepositoryService;

import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;

import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/v1")
public class ProjectExtendedController {
    private final ProjectContextService projectContextService;
    private final VersionService versionService;
    private final AddressJpaRepository addressJpaRepository;
    private final DistrictJpaRepository districtJpaRepository;
    private final ProjectParticipantJpaRepository projectParticipantJpaRepository;
    private final ProjectDocumentJpaRepository projectDocumentJpaRepository;
    private final ProjectJpaRepository projectJpaRepository;
    private final RegionJpaRepository regionJpaRepository;
    private final ProjectFullRegistryService projectFullRegistryService;
    private final ProjectGeometryService projectGeometryService;
    private final ProjectRegistryDetailsService projectRegistryDetailsService;
    private final ProjectBuildingDetailsService projectBuildingDetailsService;
    private final SecurityPolicyService securityPolicyService;
    private final ProjectService projectService;
    private final ApplicationRepositoryService applicationRepositoryService;

    public ProjectExtendedController(
        ProjectContextService projectContextService,
        VersionService versionService,
        AddressJpaRepository addressJpaRepository,
        DistrictJpaRepository districtJpaRepository,
        ProjectParticipantJpaRepository projectParticipantJpaRepository,
        ProjectDocumentJpaRepository projectDocumentJpaRepository,
        ProjectJpaRepository projectJpaRepository,
        RegionJpaRepository regionJpaRepository,
        ProjectFullRegistryService projectFullRegistryService,
        ProjectGeometryService projectGeometryService,
        ProjectRegistryDetailsService projectRegistryDetailsService,
        ProjectBuildingDetailsService projectBuildingDetailsService,
        SecurityPolicyService securityPolicyService,
        ProjectService projectService,
        ApplicationRepositoryService applicationRepositoryService
    ) {
        this.projectContextService = projectContextService;
        this.versionService = versionService;
        this.addressJpaRepository = addressJpaRepository;
        this.districtJpaRepository = districtJpaRepository;
        this.projectParticipantJpaRepository = projectParticipantJpaRepository;
        this.projectDocumentJpaRepository = projectDocumentJpaRepository;
        this.projectJpaRepository = projectJpaRepository;
        this.regionJpaRepository = regionJpaRepository;
        this.projectFullRegistryService = projectFullRegistryService;
        this.projectGeometryService = projectGeometryService;
        this.projectRegistryDetailsService = projectRegistryDetailsService;
        this.projectBuildingDetailsService = projectBuildingDetailsService;
        this.securityPolicyService = securityPolicyService;
        this.projectService = projectService;
        this.applicationRepositoryService = applicationRepositoryService;
    }

    @GetMapping("/projects/{projectId}/context")
    @Transactional
    public ProjectContextResponseDto context(@PathVariable UUID projectId, @RequestParam String scope){ return projectContextService.getProjectContext(projectId, scope); }

    @PostMapping("/projects/{projectId}/context-building-details/save")
    public MapResponseDto saveBd(@PathVariable UUID projectId, @RequestBody(required = false) BuildingDetailsSaveRequestDto payload) {
        requirePolicy("projectExtended", "mutate", "Role cannot save building details");
        return MapResponseDto.of(projectBuildingDetailsService.saveBuildingDetails(projectId, payload));
    }
    @PostMapping("/projects/{projectId}/context-meta/save")
    @Transactional
        public MapResponseDto saveMeta(@PathVariable UUID projectId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("projectExtended", "mutate", "Role cannot save context meta");
        String scope = String.valueOf(body.getOrDefault("scope", "")).trim();
        if (scope.isBlank()) throw new ApiException("scope is required", "VALIDATION_ERROR", null, 400);

        Map<String, Object> complexInfo = asMap(body.get("complexInfo"));
        if (!complexInfo.isEmpty()) {
            projectService.mergeComplexInfo(Objects.requireNonNull(projectId), complexInfo);
        }

        Map<String, Object> applicationInfo = asMap(body.get("applicationInfo"));
        UUID applicationId = null;
        if (!applicationInfo.isEmpty()) {
            applicationId = projectService.mergeApplicationInfo(projectId, scope, applicationInfo);

            List<Map<String, Object>> history = asList(applicationInfo.get("history"));
            if (!history.isEmpty()) {
                Map<String, Object> last = history.get(0);
                Instant when = parseInstant(last.get("date"));
                if (when != null && (Instant.now().toEpochMilli() - when.toEpochMilli()) < 5000) {
                    applicationRepositoryService.addHistory(
                        applicationId,
                        last.get("action") == null ? null : String.valueOf(last.get("action")),
                        last.get("prevStatus") == null ? null : String.valueOf(last.get("prevStatus")),
                        last.get("nextStatus") == null
                            ? (applicationInfo.get("status") == null ? null : String.valueOf(applicationInfo.get("status")))
                            : String.valueOf(last.get("nextStatus")),
                        last.get("user") == null ? null : String.valueOf(last.get("user")),
                        last.get("comment") == null ? null : String.valueOf(last.get("comment")),
                        when
                    );
                }
            }

            List<Integer> completedSteps = toIntList(applicationInfo.get("completedSteps"));
            for (Integer idx : completedSteps) {
                applicationRepositoryService.updateStepCompletion(applicationId, idx, true);
            }
        }

        return MapResponseDto.of(Map.of("ok", true, "projectId", projectId, "applicationId", applicationId));
    }

    @PostMapping("/projects/{projectId}/step-block-statuses/save")
    @Transactional
    public MapResponseDto saveStep(@PathVariable UUID projectId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("projectExtended", "mutate", "Role cannot save step block statuses");
        String scope = String.valueOf(body.getOrDefault("scope", "")).trim();
        Integer stepIndex = toNullableInt(body.get("stepIndex"));
        if (scope.isBlank()) throw new ApiException("scope is required", "VALIDATION_ERROR", null, 400);
        if (stepIndex == null || stepIndex < 0) throw new ApiException("stepIndex must be non-negative", "VALIDATION_ERROR", null, 400);

        Map<String, Object> statuses = asMap(body.get("statuses"));
        UUID appId = applicationRepositoryService.saveStepBlockStatuses(projectId, scope, stepIndex, statuses);

        return MapResponseDto.of(Map.of("applicationId", appId, "stepIndex", stepIndex, "blockStatuses", statuses));
    }

    @GetMapping("/projects/{projectId}/context-registry-details")
    public MapResponseDto registryDetails(@PathVariable UUID projectId) {
        return MapResponseDto.of(projectRegistryDetailsService.getRegistryDetails(projectId));
    }

    @GetMapping("/projects/{projectId}/geometry-candidates")
    public ItemsResponseDto candidates(@PathVariable UUID projectId){
        return new ItemsResponseDto(projectGeometryService.getCandidates(projectId));
    }

@PostMapping("/projects/{projectId}/geometry-candidates/import")
    public MapResponseDto importCandidates(@PathVariable UUID projectId, @RequestBody(required = false) GeometryCandidatesImportRequestDto payload){
        requirePolicy("projectExtended", "mutate", "Role cannot import geometry candidates");
        List<GeometryCandidateImportItemDto> candidates = payload == null || payload.candidates() == null ? List.of() : payload.candidates();
        if (candidates.isEmpty()) throw new ApiException("Candidates payload is required", "VALIDATION_ERROR", null, 400);

        int imported = projectGeometryService.importCandidates(projectId, candidates);
        return MapResponseDto.of(Map.of("ok", true, "imported", imported));
    }

    @PostMapping("/projects/{projectId}/land-plot/select")
    @Transactional
    public OkResponseDto selectLand(@PathVariable UUID projectId, @RequestBody(required = false) Map<String, Object> payload) {
        requirePolicy("projectExtended", "mutate", "Role cannot select land plot geometry");
        UUID candidateId = extractCandidateId(payload);
        if (candidateId == null) {
            throw new ApiException("candidateId is required", "VALIDATION_ERROR", null, 400);
        }
        projectGeometryService.selectLand(projectId, candidateId);
        return new OkResponseDto(true);
    }
    @PostMapping("/projects/{projectId}/land-plot/unselect")
    @Transactional
    public OkResponseDto unselectLand(@PathVariable UUID projectId) {
        requirePolicy("projectExtended", "mutate", "Role cannot unselect land plot geometry");
        projectGeometryService.unselectLand(projectId);
        return new OkResponseDto(true);
    }

    @DeleteMapping("/projects/{projectId}/geometry-candidates/{candidateId}")
    @Transactional
    public OkResponseDto delCandidate(@PathVariable UUID projectId, @PathVariable UUID candidateId) {
        requirePolicy("projectExtended", "mutate", "Role cannot delete geometry candidate");
        projectGeometryService.deleteCandidate(projectId, candidateId);
        return new OkResponseDto(true);
    }

  @PostMapping("/projects/{projectId}/buildings/{buildingId}/geometry/select")
    @Transactional
    public OkResponseDto selectBuildingGeometry(
        @PathVariable UUID projectId,
        @PathVariable UUID buildingId,
        @RequestBody(required = false) Map<String, Object> payload
    ) {
        requirePolicy("projectExtended", "mutate", "Role cannot select building geometry");
        UUID candidateId = extractCandidateId(payload);
        projectGeometryService.selectBuildingGeometry(projectId, buildingId, candidateId);
        return new OkResponseDto(true);
    }
    @GetMapping("/projects/{projectId}/passport")
    public MapResponseDto passport(@PathVariable UUID projectId) {
        ProjectEntity project = projectJpaRepository.findById(projectId)
            .orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));

        AddressEntity address = project.getAddressId() == null
            ? null
            : addressJpaRepository.findById(project.getAddressId()).orElse(null);

        String regionSoato = resolveRegionSoato(address);

        List<ProjectParticipantEntity> participantsRows = projectParticipantJpaRepository.findByProjectId(projectId);
        List<ProjectDocumentEntity> docsRows = projectDocumentJpaRepository.findByProjectIdOrderByDocDateDescIdDesc(projectId);

Map<String, Object> participants = new LinkedHashMap<>();
        for (ProjectParticipantEntity part : participantsRows) {
            String role = part.getRole();
            Map<String, Object> pMap = new HashMap<>();
            pMap.put("id", part.getId());
            pMap.put("name", part.getName());
            pMap.put("inn", part.getInn());
            pMap.put("role", role);
            participants.put(role, pMap);
        }

        List<Map<String, Object>> documents = docsRows.stream().map(d -> {
            Map<String, Object> doc = new LinkedHashMap<>();
            doc.put("id", d.getId());
            doc.put("name", d.getName());
            doc.put("type", d.getDocType());
            doc.put("date", d.getDocDate());
            doc.put("number", d.getDocNumber());
            doc.put("url", d.getFileUrl());
            return doc;
        }).toList();

        Map<String, Object> complexInfo = new LinkedHashMap<>();
        complexInfo.put("name", project.getName());
        complexInfo.put("ujCode", project.getUjCode());
        complexInfo.put("ujCode", project.getUjCode());
        complexInfo.put("status", project.getConstructionStatus());
        complexInfo.put("region", project.getRegion());
        complexInfo.put("district", project.getDistrict());
        complexInfo.put("street", project.getAddress());
        complexInfo.put("landmark", project.getLandmark());
        complexInfo.put("addressId", project.getAddressId());
        complexInfo.put("dateStartProject", project.getDateStartProject());
        complexInfo.put("dateEndProject", project.getDateEndProject());
        complexInfo.put("dateStartFact", project.getDateStartFact());
        complexInfo.put("dateEndFact", project.getDateEndFact());
        complexInfo.put("regionSoato", regionSoato);
        complexInfo.put("districtSoato", address == null ? null : address.getDistrict());
        complexInfo.put("streetId", address == null ? null : address.getStreet());
        complexInfo.put("mahallaId", address == null ? null : address.getMahalla());
        complexInfo.put("buildingNo", address == null ? null : address.getBuildingNo());

   Map<String, Object> cadastreInfo = new HashMap<>();
        cadastreInfo.put("number", project.getCadastreNumber());
        cadastreInfo.put("area", project.getLandPlotAreaM2());

        Map<String, Object> landPlotInfo = new HashMap<>();
        landPlotInfo.put("geometry", project.getLandPlotGeojson());
        landPlotInfo.put("areaM2", project.getLandPlotAreaM2());

        Map<String, Object> responseData = new HashMap<>();
        responseData.put("complexInfo", complexInfo);
        responseData.put("cadastre", cadastreInfo);
        responseData.put("landPlot", landPlotInfo);
        responseData.put("participants", participants);
        responseData.put("documents", documents);

        return MapResponseDto.of(responseData);
    }

  @PutMapping("/projects/{projectId}/passport")
    public MapResponseDto updatePassport(@PathVariable UUID projectId, @RequestBody(required = false) ProjectPassportUpdateRequestDto payload){
        requirePolicy("projectExtended", "mutate", "Role cannot update passport");
        ProjectPassportInfoDto info = payload == null ? null : payload.info();
        ProjectCadastreDataDto cadastreData = payload == null ? null : payload.cadastreData();

        // 1. Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В Р’В Р В РІР‚в„–Р В Р’В Р вЂ™Р’В Р В Р Р‹Р РЋРЎСџР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІвЂћСћР В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р Р†РІР‚С›РЎС›Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРІР‚СњР В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р вЂ™Р’В Р В Р Р‹Р РЋРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂє: Р В Р’В Р вЂ™Р’В Р В Р Р‹Р РЋРЎСџР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р В Р вЂ№Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎСљР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В Р вЂ Р Р†Р вЂљРЎвЂєР Р†Р вЂљРІР‚Сљ address_id Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В· Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СњР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎСљР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°, Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р В Р вЂ№Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В±Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р Р†РІР‚С›РІР‚вЂњ Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В·Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р’В Р В РІР‚В° Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В±Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎСљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р Р†РІР‚С›РІР‚вЂњ
        ProjectEntity project = projectJpaRepository.findById(projectId)
            .orElseThrow(() -> new ApiException("Project not found", "NOT_FOUND", null, 404));
        UUID currentAddressId = project.getAddressId();

        // 2. Р В Р’В Р вЂ™Р’В Р В Р Р‹Р РЋРЎСџР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’В currentAddressId Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС› null
        UUID addressId = info == null ? null : ensureAddressRecordJpa(
            currentAddressId, 
            info.districtSoato(),
            info.streetId(),
            info.mahallaId(),
            info.buildingNo(),
            info.region(),
            info.district(),
            info.mahalla(),
            info.street()
        );

        String finalAddress = info == null ? null : buildFullAddress(info.region(), info.district(), info.mahalla(), info.street(), info.buildingNo());

        if (info != null) {
            if (info.name() != null) project.setName(info.name());
            if (info.region() != null) project.setRegion(info.region());
            if (info.district() != null) project.setDistrict(info.district());
            if (finalAddress != null) project.setAddress(finalAddress);
            if (info.landmark() != null) project.setLandmark(info.landmark());
            if (info.status() != null) project.setConstructionStatus(info.status().value());
            if (info.dateStartProject() != null) project.setDateStartProject(info.dateStartProject());
            if (info.dateEndProject() != null) project.setDateEndProject(info.dateEndProject());
            if (info.dateStartFact() != null) project.setDateStartFact(info.dateStartFact());
            if (info.dateEndFact() != null) project.setDateEndFact(info.dateEndFact());
            if (addressId != null) project.setAddressId(addressId);
        }
        if (cadastreData != null) {
            if (cadastreData.number() != null) {
                project.setCadastreNumber(uz.reestrmkd.backend.domain.common.service.FormatUtils.formatComplexCadastre(cadastreData.number()));
            }
            if (cadastreData.area() != null) {
                project.setLandPlotAreaM2(cadastreData.area());
            }
        }
        project.setUpdatedAt(Instant.now());

        ProjectEntity updated = projectJpaRepository.save(project);
        return MapResponseDto.of(toProjectMap(updated));
    }

    @PutMapping("/projects/{projectId}/participants/{role}")
    public MapResponseDto upsertParticipant(@PathVariable UUID projectId, @PathVariable String role, @RequestBody(required = false) MapPayloadDto payload){
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("projectExtended", "mutate", "Role cannot update participants");

        String normalizedRole = role == null ? "" : role.trim().toLowerCase(Locale.ROOT);
        if (!Set.of("developer", "contractor", "customer").contains(normalizedRole)) {
            throw new ApiException("Unsupported participant role", "VALIDATION_ERROR", null, 400);
        }

        Object id = body.get("id");
        UUID pid = id == null || String.valueOf(id).isBlank() ? UUID.randomUUID() : UUID.fromString(String.valueOf(id));
        Instant now = Instant.now();
        ProjectParticipantEntity participant = projectParticipantJpaRepository.findById(pid).orElseGet(ProjectParticipantEntity::new);
        participant.setId(pid);
        participant.setProjectId(projectId);
        participant.setRole(normalizedRole);
        participant.setName(String.valueOf(body.getOrDefault("name", "")));
        participant.setInn(String.valueOf(body.getOrDefault("inn", "")));
        if (participant.getCreatedAt() == null) {
            participant.setCreatedAt(now);
        }
        participant.setUpdatedAt(now);

        ProjectParticipantEntity saved = projectParticipantJpaRepository.save(participant);
        return MapResponseDto.of(toParticipantMap(saved));
    }

    @PostMapping("/projects/{projectId}/documents")
    public MapResponseDto upsertDoc(@PathVariable UUID projectId, @RequestBody(required = false) MapPayloadDto payload){
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        Map<String, Object> doc = asMap(body.get("doc"));
        if (doc.isEmpty()) doc = body;
        requirePolicy("projectExtended", "mutate", "Role cannot update documents");

        Object id = doc.get("id");
        UUID docId = id == null || String.valueOf(id).isBlank() ? UUID.randomUUID() : UUID.fromString(String.valueOf(id));
        Instant now = Instant.now();
        ProjectDocumentEntity entity = projectDocumentJpaRepository.findById(docId).orElseGet(ProjectDocumentEntity::new);
        entity.setId(docId);
        entity.setProjectId(projectId);
        entity.setName(String.valueOf(doc.getOrDefault("name", "")));
        entity.setDocType(String.valueOf(doc.getOrDefault("type", "")));
        entity.setDocDate(parseLocalDate(doc.get("date")));
        entity.setDocNumber(String.valueOf(doc.getOrDefault("number", "")));
        entity.setFileUrl(doc.get("url") == null ? null : String.valueOf(doc.get("url")));
        if (entity.getCreatedAt() == null) {
            entity.setCreatedAt(now);
        }
        entity.setUpdatedAt(now);

        ProjectDocumentEntity saved = projectDocumentJpaRepository.save(entity);
        return MapResponseDto.of(toDocumentMap(saved));
    }

    @DeleteMapping("/project-documents/{documentId}")
    public MapResponseDto delDoc(@PathVariable UUID documentId){
        requirePolicy("projectExtended", "mutate", "Role cannot delete documents");
        projectDocumentJpaRepository.deleteById(documentId);
        return MapResponseDto.of(Map.of("ok", true));
    }    
    @DeleteMapping("/projects/{projectId}") public OkResponseDto delProject(@PathVariable UUID projectId){requirePolicy("projectExtended", "deleteProject", "Role cannot delete project");projectJpaRepository.deleteById(projectId);return new OkResponseDto(true);}    
  @GetMapping("/projects/{projectId}/full-registry")
    public Map<String, Object> fullRegistry(@PathVariable UUID projectId) {
        return projectFullRegistryService.getFullRegistry(projectId);
    }
    @GetMapping("/versions") public ItemsResponseDto versions(@RequestParam(required=false) String entityType,@RequestParam(required=false) UUID entityId){ return new ItemsResponseDto(versionService.getVersions(entityType, entityId)); }
    @PostMapping("/versions") public MapResponseDto createVersion(@RequestBody(required = false) MapPayloadDto payload){ Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data(); UUID projectId = Objects.requireNonNull(UUID.fromString(String.valueOf(body.get("projectId")))); UUID applicationId = Objects.requireNonNull(UUID.fromString(String.valueOf(body.get("applicationId")))); return MapResponseDto.of(Map.of("result",versionService.createPendingVersionsForApplication(projectId, applicationId, body.get("createdBy")==null?null:String.valueOf(body.get("createdBy"))))); }
    @PostMapping("/versions/{versionId}/approve") public OkResponseDto approveVersion(@PathVariable Long versionId){versionService.approveVersion(versionId);return new OkResponseDto(true);}    
    @PostMapping("/versions/{versionId}/decline") public OkResponseDto declineVersion(@PathVariable Long versionId){versionService.declineVersion(versionId);return new OkResponseDto(true);}    
    @GetMapping("/versions/{versionId}/snapshot") public MapResponseDto snapshot(@PathVariable Long versionId){return MapResponseDto.of(versionService.getSnapshot(versionId));}    
    @PostMapping("/versions/{versionId}/restore") public OkResponseDto restore(@PathVariable Long versionId){versionService.restoreVersion(versionId);return new OkResponseDto(true);}    

    private UUID ensureAddressRecordJpa(
            UUID addressId,
            String districtSoato,
            String streetId,
            String mahallaId,
            String buildingNo,
            String regionName,
            String districtName,
            String mahallaName,
            String streetName
    ) {
        boolean hasAddressData = !isBlank(districtSoato) || !isBlank(streetId) || !isBlank(mahallaId) || !isBlank(buildingNo);
        if (!hasAddressData) {
            return addressId;
        }

        UUID resolvedAddressId = addressId == null ? UUID.randomUUID() : addressId;
        String fullAddress = buildFullAddress(regionName, districtName, mahallaName, streetName, buildingNo);

        AddressEntity address = addressJpaRepository.findById(resolvedAddressId).orElseGet(AddressEntity::new);
        address.setId(resolvedAddressId);
        address.setDtype("Address");
        address.setVersionrev(0);
        address.setDistrict(districtSoato);
        address.setStreet(parseUuid(streetId));
        address.setMahalla(parseUuid(mahallaId));
        address.setCity(regionName);
        address.setBuildingNo(buildingNo);
        address.setFullAddress(fullAddress);
        addressJpaRepository.save(address);
        return resolvedAddressId;
    }

    private String resolveRegionSoato(AddressEntity address) {
        String districtSoato = address == null || address.getDistrict() == null ? null : String.valueOf(address.getDistrict());
        if (isBlank(districtSoato)) {
            return null;
        }

        DistrictEntity district = districtJpaRepository.findBySoato(districtSoato).orElse(null);
        if (district == null || district.getRegionId() == null) {
            return null;
        }

        RegionEntity region = regionJpaRepository.findById(district.getRegionId()).orElse(null);
        return region == null ? null : region.getSoato();
    }

private String buildFullAddress(String regionName, String districtName, String mahallaName, String streetName, String buildingNo) {
        List<String> parts = new ArrayList<>();
        
        // Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’В streetName Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В¶Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В¶Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћ Р В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦, Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В±Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р В Р вЂ№Р В Р’В Р В Р РЏР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС› Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›
        if (!isBlank(regionName) && (isBlank(streetName) || !streetName.contains(regionName.trim()))) {
            parts.add(regionName.trim());
        }
        
        // Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’В streetName Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В¶Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В¶Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћ Р В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р вЂ Р Р†Р вЂљРЎвЂєР Р†Р вЂљРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦, Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В±Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р В Р вЂ№Р В Р’В Р В Р РЏР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›
        if (!isBlank(districtName) && (isBlank(streetName) || !streetName.contains(districtName.trim()))) {
            parts.add(districtName.trim());
        }
        
        // Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’В streetName Р В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В¶Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В¶Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћ Р В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В¦Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРІвЂћвЂ“, Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В±Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р В Р вЂ№Р В Р’В Р В Р РЏР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ
        if (!isBlank(mahallaName) && (isBlank(streetName) || !streetName.contains(mahallaName.trim()))) {
            parts.add(mahallaName.trim());
        }
        
        // Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРЎС™Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В±Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р В Р вЂ№Р В Р’В Р В Р РЏР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’В Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’ВР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™ Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎСљР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™, Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎСљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р В Р вЂ№Р В Р Р‹Р Р†Р вЂљРЎС™Р В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРІвЂћвЂ“ Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СњР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’ВР В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В» Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІР‚С”Р В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В  Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ street (Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р В Р вЂ№Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС› Р В Р’В Р В Р вЂ№Р В Р’В Р В Р вЂ°Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС› Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р Р†РІР‚С›РІР‚вЂњР В Р’В Р вЂ™Р’В Р В Р вЂ Р Р†Р вЂљРЎвЂєР Р†Р вЂљРІР‚Сљ Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚Сљ)
        if (!isBlank(streetName)) {
            parts.add(streetName.trim());
        }
        
        // Р В Р’В Р вЂ™Р’В Р В Р вЂ Р В РІР‚С™Р РЋРЎвЂєР В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ў Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В° Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СњР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦ Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р В Р вЂ№Р В Р’В Р В РІР‚В°Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС› Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРІР‚СљР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС› Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В¦Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћ Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В  Р В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р В Р вЂ№Р В Р вЂ Р В РІР‚С™Р РЋРІвЂћСћР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎСљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’Вµ Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р В Р вЂ№Р В Р’В Р Р†Р вЂљРЎв„ўР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р В Р вЂ№Р В Р’В Р РЋРІР‚СљР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°, Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’ВР В Р’В Р вЂ™Р’В Р В Р Р‹Р Р†Р вЂљРЎС›Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В±Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В°Р В Р’В Р вЂ™Р’В Р В Р’В Р Р†Р вЂљР’В Р В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’В»Р В Р’В Р В Р вЂ№Р В Р’В Р В Р РЏР В Р’В Р вЂ™Р’В Р В РІР‚в„ўР вЂ™Р’ВµР В Р’В Р вЂ™Р’В Р В Р Р‹Р вЂ™Р’В
        if (!isBlank(buildingNo) && (isBlank(streetName) || !streetName.matches(".*\\b" + buildingNo.trim() + "\\b.*"))) {
            parts.add("Р В Р’В Р вЂ™Р’В Р В РЎС›Р Р†Р вЂљР’В. " + buildingNo.trim());
        }
        
        return parts.isEmpty() ? null : String.join(", ", parts);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> m) return (Map<String, Object>) m;
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(v -> (Map<String, Object>) v).toList();
    }

    private Integer toNullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        String s = String.valueOf(value).trim();
        if (s.isBlank()) return null;
        try {
            return Integer.parseInt(s);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean toBool(Object value) {
        if (value instanceof Boolean b) return b;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private UUID extractCandidateId(Map<String, Object> payload) {
        Map<String, Object> body = payload == null ? Map.of() : payload;
        Object direct = body.get("candidateId");
        if (direct != null) return parseUuid(direct);
        return parseUuid(asMap(body.get("data")).get("candidateId"));
    }

    private Map<String, Object> toProjectMap(ProjectEntity project) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", project.getId());
        mapped.put("scope_id", project.getScopeId());
        mapped.put("uj_code", project.getUjCode());
        mapped.put("name", project.getName());
        mapped.put("region", project.getRegion());
        mapped.put("district", project.getDistrict());
        mapped.put("address", project.getAddress());
        mapped.put("landmark", project.getLandmark());
        mapped.put("cadastre_number", project.getCadastreNumber());
        mapped.put("construction_status", project.getConstructionStatus());
        mapped.put("date_start_project", project.getDateStartProject());
        mapped.put("date_end_project", project.getDateEndProject());
        mapped.put("date_start_fact", project.getDateStartFact());
        mapped.put("date_end_fact", project.getDateEndFact());
        mapped.put("address_id", project.getAddressId());
        mapped.put("land_plot_geojson", project.getLandPlotGeojson());
        mapped.put("land_plot_area_m2", project.getLandPlotAreaM2());
        mapped.put("created_at", project.getCreatedAt());
        mapped.put("updated_at", project.getUpdatedAt());
        return mapped;
    }

    private Map<String, Object> toParticipantMap(ProjectParticipantEntity participant) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", participant.getId());
        mapped.put("project_id", participant.getProjectId());
        mapped.put("role", participant.getRole());
        mapped.put("name", participant.getName());
        mapped.put("inn", participant.getInn());
        mapped.put("created_at", participant.getCreatedAt());
        mapped.put("updated_at", participant.getUpdatedAt());
        return mapped;
    }

    private Map<String, Object> toDocumentMap(ProjectDocumentEntity document) {
        Map<String, Object> mapped = new LinkedHashMap<>();
        mapped.put("id", document.getId());
        mapped.put("project_id", document.getProjectId());
        mapped.put("name", document.getName());
        mapped.put("doc_type", document.getDocType());
        mapped.put("doc_date", document.getDocDate());
        mapped.put("doc_number", document.getDocNumber());
        mapped.put("file_url", document.getFileUrl());
        mapped.put("created_at", document.getCreatedAt());
        mapped.put("updated_at", document.getUpdatedAt());
        return mapped;
    }

    private java.time.LocalDate parseLocalDate(Object value) {
        if (value == null) return null;
        if (value instanceof java.time.LocalDate localDate) return localDate;
        String raw = String.valueOf(value).trim();
        if (raw.isBlank()) return null;
        try {
            return java.time.LocalDate.parse(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private UUID parseUuid(Object value) {
        if (value == null) return null;
        String raw = String.valueOf(value).trim();
        if (raw.isBlank() || raw.length() != 36) return null;
        try {
            return UUID.fromString(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private Instant parseInstant(Object value) {
        if (value == null) return null;
        if (value instanceof Instant instant) return instant;
        try {
            return Instant.parse(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }

    private List<Integer> toIntList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        List<Integer> result = new ArrayList<>();
        for (Object item : list) {
            Integer v = toNullableInt(item);
            if (v != null) result.add(v);
        }
        return result;
    }

    private void requirePolicy(String module, String action, String message) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ActorPrincipal actor)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRole(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}
