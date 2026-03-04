package uz.reestr.mkd.backendjpa.controller;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.IntegrationRequestDtos.SyncBuildingsRequest;
import uz.reestr.mkd.backendjpa.dto.IntegrationRequestDtos.SyncUnitsRequest;
import uz.reestr.mkd.backendjpa.dto.IntegrationRequestDtos.UpdateCadastreRequest;
import uz.reestr.mkd.backendjpa.dto.IntegrationRequestDtos.UpdateIntegrationStatusRequest;
import uz.reestr.mkd.backendjpa.dto.IntegrationResponseDtos.IntegrationStatusResponse;
import uz.reestr.mkd.backendjpa.dto.IntegrationResponseDtos.SyncResultResponse;
import uz.reestr.mkd.backendjpa.dto.IntegrationResponseDtos.UpdateCadastreResponse;
import uz.reestr.mkd.backendjpa.dto.IntegrationResponseDtos.UpdateIntegrationStatusResponse;
import uz.reestr.mkd.backendjpa.service.IntegrationJpaService;

@RestController
@RequestMapping("/api/v1")
public class IntegrationController {

  private final IntegrationJpaService integrationJpaService;

  public IntegrationController(IntegrationJpaService integrationJpaService) {
    this.integrationJpaService = integrationJpaService;
  }

  @GetMapping("/projects/{projectId}/integration-status")
  public ResponseEntity<IntegrationStatusResponse> getIntegrationStatus(@PathVariable UUID projectId) {
    return ResponseEntity.ok(new IntegrationStatusResponse(integrationJpaService.getIntegrationStatus(projectId)));
  }

  @PutMapping("/projects/{projectId}/integration-status")
  public ResponseEntity<UpdateIntegrationStatusResponse> updateIntegrationStatus(
      @PathVariable UUID projectId,
      @RequestBody UpdateIntegrationStatusRequest request
  ) {
    return ResponseEntity.ok(new UpdateIntegrationStatusResponse(
        true,
        integrationJpaService.updateIntegrationStatus(projectId, request == null ? null : request.field(), request == null ? null : request.status())
    ));
  }

  @PutMapping("/buildings/{buildingId}/cadastre")
  public ResponseEntity<UpdateCadastreResponse> updateBuildingCadastre(
      @PathVariable UUID buildingId,
      @RequestBody UpdateCadastreRequest request
  ) {
    var updated = integrationJpaService.updateBuildingCadastre(buildingId, request == null ? null : request.cadastre());
    return ResponseEntity.ok(new UpdateCadastreResponse(true, updated.id(), updated.cadastre()));
  }

  @PutMapping("/units/{unitId}/cadastre")
  public ResponseEntity<UpdateCadastreResponse> updateUnitCadastre(
      @PathVariable UUID unitId,
      @RequestBody UpdateCadastreRequest request
  ) {
    var updated = integrationJpaService.updateUnitCadastre(unitId, request == null ? null : request.cadastre());
    return ResponseEntity.ok(new UpdateCadastreResponse(true, updated.id(), updated.cadastre()));
  }

  @PostMapping("/integration/buildings/sync")
  public ResponseEntity<SyncResultResponse> syncBuildings(@RequestBody SyncBuildingsRequest request) {
    return ResponseEntity.ok(integrationJpaService.syncBuildings(request));
  }

  @PostMapping("/integration/units/sync")
  public ResponseEntity<SyncResultResponse> syncUnits(@RequestBody SyncUnitsRequest request) {
    return ResponseEntity.ok(integrationJpaService.syncUnits(request));
  }
}
