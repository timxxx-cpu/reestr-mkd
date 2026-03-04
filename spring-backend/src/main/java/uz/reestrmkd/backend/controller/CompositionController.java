package uz.reestrmkd.backend.controller;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.BuildingDataDto;
import uz.reestrmkd.backend.dto.BuildingDbDto;
import uz.reestrmkd.backend.dto.CompositionUpsertBuildingRequestDto;
import uz.reestrmkd.backend.dto.IdResponseDto;
import uz.reestrmkd.backend.dto.OkResponseDto;
import uz.reestrmkd.backend.entity.BuildingEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.mapper.EntityToDtoMapper;
import uz.reestrmkd.backend.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.service.SecurityPolicyService;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class CompositionController {
    private final BuildingJpaRepository buildingRepo;
    private final BuildingBlockJpaRepository blockRepo;
    private final SecurityPolicyService securityPolicyService;

    public CompositionController(BuildingJpaRepository buildingRepo, BuildingBlockJpaRepository blockRepo, SecurityPolicyService securityPolicyService) {
        this.buildingRepo = buildingRepo;
        this.blockRepo = blockRepo;
        this.securityPolicyService = securityPolicyService;
    }

    @GetMapping("/projects/{projectId}/buildings")
    public List<BuildingDbDto> getBuildings(@PathVariable UUID projectId) {
        List<BuildingEntity> buildings = buildingRepo.findByProjectIdOrderByCreatedAtAsc(projectId);
        var blocks = blockRepo.findByBuildingIdIn(buildings.stream().map(BuildingEntity::getId).toList());
        return buildings.stream().map(b -> EntityToDtoMapper.toBuildingDto(b,
            blocks.stream().filter(x -> x.getBuildingId().equals(b.getId())).map(bb -> EntityToDtoMapper.toBuildingBlockDto(bb, List.of(), List.of(), List.of(), List.of())).toList()
        )).toList();
    }

    @PostMapping("/projects/{projectId}/buildings")
    public IdResponseDto create(@PathVariable UUID projectId, @RequestBody CompositionUpsertBuildingRequestDto body) {
        requirePolicy("composition", "mutate", "Role cannot create composition data");
        BuildingDataDto buildingData = body == null || body.buildingData() == null ? new BuildingDataDto(null, null, null) : body.buildingData();
        BuildingEntity b = new BuildingEntity();
        b.setId(UUID.randomUUID());
        b.setProjectId(projectId);
        b.setLabel(buildingData.label() == null || buildingData.label().isBlank() ? "Корпус" : buildingData.label());
        b.setCategory(buildingData.category() == null || buildingData.category().isBlank() ? "residential" : buildingData.category());
        b.setHouseNumber(buildingData.houseNumber());
        b.setCreatedAt(Instant.now());
        b.setUpdatedAt(Instant.now());
        buildingRepo.save(b);
        return new IdResponseDto(b.getId());
    }

    @PutMapping("/buildings/{buildingId}")
    public OkResponseDto update(@PathVariable UUID buildingId, @RequestBody CompositionUpsertBuildingRequestDto body) {
        requirePolicy("composition", "mutate", "Role cannot update composition data");
        BuildingEntity b = buildingRepo.findById(buildingId).orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        BuildingDataDto buildingData = body == null ? null : body.buildingData();
        if (buildingData != null) {
            if (buildingData.label() != null) b.setLabel(buildingData.label());
            if (buildingData.houseNumber() != null) b.setHouseNumber(buildingData.houseNumber());
        }
        b.setUpdatedAt(Instant.now());
        buildingRepo.save(b);
        return new OkResponseDto(true);
    }

    @DeleteMapping("/buildings/{buildingId}")
    public OkResponseDto delete(@PathVariable UUID buildingId) {
        requirePolicy("composition", "mutate", "Role cannot delete composition data");
        blockRepo.findByBuildingId(buildingId).forEach(blockRepo::delete);
        buildingRepo.deleteById(buildingId);
        return new OkResponseDto(true);
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
