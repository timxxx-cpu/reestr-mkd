package uz.reestr.mkd.backendjpa.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import uz.reestr.mkd.backendjpa.dto.CatalogRequestDtos.SetCatalogItemActiveRequest;
import uz.reestr.mkd.backendjpa.dto.CatalogRequestDtos.UpsertCatalogItemRequest;
import uz.reestr.mkd.backendjpa.dto.CatalogResponseDtos.CatalogItemsResponse;
import uz.reestr.mkd.backendjpa.dto.CatalogResponseDtos.SetCatalogItemActiveResponse;
import uz.reestr.mkd.backendjpa.dto.CatalogResponseDtos.SystemUsersResponse;
import uz.reestr.mkd.backendjpa.dto.CatalogResponseDtos.UpsertCatalogItemResponse;
import uz.reestr.mkd.backendjpa.service.CatalogJpaService;

@RestController
@RequestMapping("/api/v1/catalogs")
public class CatalogController {

  private final CatalogJpaService catalogJpaService;

  public CatalogController(CatalogJpaService catalogJpaService) {
    this.catalogJpaService = catalogJpaService;
  }

  @GetMapping(value = "/{table}", params = "activeOnly")
  public ResponseEntity<CatalogItemsResponse> getCatalog(
      @PathVariable String table,
      @RequestParam(required = false) Boolean activeOnly
  ) {
    return ResponseEntity.ok(catalogJpaService.getCatalog(table, activeOnly));
  }

  @GetMapping("/dict_system_users")
  public ResponseEntity<SystemUsersResponse> getSystemUsers(@RequestParam(required = false) Boolean activeOnly) {
    return ResponseEntity.ok(catalogJpaService.getSystemUsers(activeOnly));
  }

  @GetMapping(value = "/{table}", params = "!activeOnly")
  public ResponseEntity<CatalogItemsResponse> getCatalogAll(@PathVariable String table) {
    return ResponseEntity.ok(catalogJpaService.getCatalogAll(table));
  }

  @PostMapping("/{table}/upsert")
  public ResponseEntity<UpsertCatalogItemResponse> upsertCatalogItem(
      @PathVariable String table,
      @RequestBody UpsertCatalogItemRequest request
  ) {
    return ResponseEntity.ok(catalogJpaService.upsertCatalogItem(table, request));
  }

  @PutMapping("/{table}/{id}/active")
  public ResponseEntity<SetCatalogItemActiveResponse> setCatalogItemActive(
      @PathVariable String table,
      @PathVariable String id,
      @RequestBody SetCatalogItemActiveRequest request
  ) {
    return ResponseEntity.ok(catalogJpaService.setCatalogItemActive(table, id, request));
  }
}
