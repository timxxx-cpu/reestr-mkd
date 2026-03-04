package uz.reestrmkd.backend.controller;

import jakarta.validation.Valid;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.CadastreUpdateRequestDto;
import uz.reestrmkd.backend.dto.IntegrationStatusUpdateRequestDto;
import uz.reestrmkd.backend.dto.ItemsResponseDto;
import uz.reestrmkd.backend.dto.OkResponseDto;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.repository.UnitJpaRepository;
import uz.reestrmkd.backend.service.IntegrationService;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class IntegrationController {
    private final JdbcTemplate jdbcTemplate;
    private final IntegrationService integrationService;
    private final BuildingJpaRepository buildingJpaRepository;
    private final UnitJpaRepository unitJpaRepository;

    public IntegrationController(JdbcTemplate jdbcTemplate, IntegrationService integrationService, BuildingJpaRepository buildingJpaRepository, UnitJpaRepository unitJpaRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.integrationService = integrationService;
        this.buildingJpaRepository = buildingJpaRepository;
        this.unitJpaRepository = unitJpaRepository;
    }

    @GetMapping("/projects/{projectId}/integration-status")
    public ItemsResponseDto getStatus(@PathVariable UUID projectId){
        return new ItemsResponseDto(jdbcTemplate.queryForList("select * from applications where project_id = ?", projectId));
    }

    @PutMapping("/projects/{projectId}/integration-status")
    public OkResponseDto updateStatus(@PathVariable UUID projectId,@RequestBody(required = false) IntegrationStatusUpdateRequestDto body){
        integrationService.updateIntegrationStatus(
            projectId,
            body == null ? null : body.field(),
            body == null ? null : body.status()
        );
        return new OkResponseDto(true);
    }

    @Transactional
    @PutMapping("/buildings/{buildingId}/cadastre")
    public OkResponseDto updateBuildingCadastre(@PathVariable UUID buildingId,@Valid @RequestBody CadastreUpdateRequestDto body){
        int updated = buildingJpaRepository.updateCadastreNumber(buildingId, body.cadastre(), Instant.now());
        if (updated == 0) {
            throw new ApiException("Building not found", "NOT_FOUND", null, 404);
        }
        return new OkResponseDto(true);
    }

    @Transactional
    @PutMapping("/units/{unitId}/cadastre")
    public OkResponseDto updateUnitCadastre(@PathVariable UUID unitId,@Valid @RequestBody CadastreUpdateRequestDto body){
        int updated = unitJpaRepository.updateCadastreNumber(unitId, body.cadastre(), Instant.now());
        if (updated == 0) {
            throw new ApiException("Unit not found", "NOT_FOUND", null, 404);
        }
        return new OkResponseDto(true);
    }
}
