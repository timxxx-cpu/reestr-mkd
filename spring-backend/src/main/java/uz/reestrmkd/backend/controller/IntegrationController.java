package uz.reestrmkd.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.CadastreUpdateRequestDto;
import uz.reestrmkd.backend.dto.MapResponseDto;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.service.FormatUtils;
import uz.reestrmkd.backend.service.SecurityPolicyService;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class IntegrationController {
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final SecurityPolicyService securityPolicyService;

    public IntegrationController(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper, SecurityPolicyService securityPolicyService) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.securityPolicyService = securityPolicyService;
    }

    @GetMapping("/projects/{projectId}/integration-status")
    public MapResponseDto getStatus(@PathVariable UUID projectId) {
        List<String> rows = jdbcTemplate.queryForList(
            "select integration_data::text from applications where project_id = ? order by created_at desc limit 1",
            String.class,
            projectId
        );

        if (rows.isEmpty() || rows.getFirst() == null || rows.getFirst().isBlank()) {
            return MapResponseDto.of(Map.of());
        }

        try {
            Map<String, Object> payload = objectMapper.readValue(rows.getFirst(), new TypeReference<>() {});
            return MapResponseDto.of(payload == null ? Map.of() : payload);
        } catch (Exception ex) {
            throw new ApiException("Invalid integration payload", "INTERNAL_ERROR", ex.getMessage(), 500);
        }
    }

    @PutMapping("/projects/{projectId}/integration-status")
    public MapResponseDto updateStatus(@PathVariable UUID projectId, @RequestBody(required = false) Map<String, Object> body) {
        requirePolicy("integration", "mutate", "Role cannot modify integration data");

        String field = body == null || body.get("field") == null ? null : String.valueOf(body.get("field")).trim();
        if (field == null || field.isBlank()) {
            throw new ApiException("field is required", "VALIDATION_ERROR", null, 400);
        }

        Object status = body.get("status");

        List<Map<String, Object>> appRows = jdbcTemplate.queryForList(
            "select id, integration_data::text as integration_data from applications where project_id = ? order by created_at desc limit 1",
            projectId
        );
        if (appRows.isEmpty()) {
            throw new ApiException("Application not found", "NOT_FOUND", null, 404);
        }

        Map<String, Object> appRow = appRows.getFirst();
        UUID appId = UUID.fromString(String.valueOf(appRow.get("id")));
        Map<String, Object> integrationData = new LinkedHashMap<>();
        try {
            Object raw = appRow.get("integration_data");
            if (raw != null && !String.valueOf(raw).isBlank()) {
                integrationData.putAll(objectMapper.readValue(String.valueOf(raw), new TypeReference<>() {}));
            }
        } catch (Exception ex) {
            throw new ApiException("Invalid integration payload", "INTERNAL_ERROR", ex.getMessage(), 500);
        }

        integrationData.put(field, status);

        try {
            jdbcTemplate.update(
                "update applications set integration_data = cast(? as jsonb), updated_at = ? where id = ?",
                objectMapper.writeValueAsString(integrationData),
                Instant.now(),
                appId
            );
        } catch (Exception ex) {
            throw new ApiException("Failed to update integration status", "DB_ERROR", ex.getMessage(), 500);
        }

        return MapResponseDto.of(Map.of("ok", true, "integrationData", integrationData));
    }

    @PutMapping("/buildings/{buildingId}/cadastre")
    public MapResponseDto updateBuildingCadastre(@PathVariable UUID buildingId, @RequestBody(required = false) CadastreUpdateRequestDto body) {
        requirePolicy("integration", "mutate", "Role cannot modify cadastre data");

        String cadastre = FormatUtils.formatBuildingCadastre(body == null ? null : body.cadastre());
        int updated = jdbcTemplate.update(
            "update buildings set cadastre_number = ?, updated_at = ? where id = ?",
            cadastre,
            Instant.now(),
            buildingId
        );
        if (updated == 0) {
            throw new ApiException("Building not found", "NOT_FOUND", null, 404);
        }
        return MapResponseDto.of(Map.of("ok", true, "id", buildingId, "cadastre", cadastre));
    }

    @PutMapping("/units/{unitId}/cadastre")
    public MapResponseDto updateUnitCadastre(@PathVariable UUID unitId, @RequestBody(required = false) CadastreUpdateRequestDto body) {
        requirePolicy("integration", "mutate", "Role cannot modify cadastre data");

        String cadastre = body == null || body.cadastre() == null || body.cadastre().isBlank()
            ? null
            : body.cadastre().trim();
        int updated = jdbcTemplate.update(
            "update units set cadastre_number = ?, updated_at = ? where id = ?",
            cadastre,
            Instant.now(),
            unitId
        );
        if (updated == 0) {
            throw new ApiException("Unit not found", "NOT_FOUND", null, 404);
        }
        return MapResponseDto.of(Map.of("ok", true, "id", unitId, "cadastre", cadastre));
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
