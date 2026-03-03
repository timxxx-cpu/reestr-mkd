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

@RestController
@RequestMapping("/api/v1/catalogs")
public class CatalogController {

  @GetMapping(value = "/{table}", params = "activeOnly")
  public ResponseEntity<Void> getCatalog(
      @PathVariable String table,
      @RequestParam(required = false) Boolean activeOnly
  ) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/dict_system_users")
  public ResponseEntity<Void> getSystemUsers(@RequestParam(required = false) Boolean activeOnly) {
    return ResponseEntity.noContent().build();
  }

  @GetMapping(value = "/{table}", params = "!activeOnly")
  public ResponseEntity<Void> getCatalogAll(@PathVariable String table) {
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{table}/upsert")
  public ResponseEntity<Void> upsertCatalogItem(
      @PathVariable String table,
      @RequestBody UpsertCatalogItemRequest request
  ) {
    return ResponseEntity.noContent().build();
  }

  @PutMapping("/{table}/{id}/active")
  public ResponseEntity<Void> setCatalogItemActive(
      @PathVariable String table,
      @PathVariable String id,
      @RequestBody SetCatalogItemActiveRequest request
  ) {
    return ResponseEntity.noContent().build();
  }
}
