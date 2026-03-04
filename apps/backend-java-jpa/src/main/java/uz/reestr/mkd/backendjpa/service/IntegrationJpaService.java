package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.IntegrationRequestDtos.BuildingSyncItem;
import uz.reestr.mkd.backendjpa.dto.IntegrationRequestDtos.SyncBuildingsRequest;
import uz.reestr.mkd.backendjpa.dto.IntegrationRequestDtos.SyncUnitsRequest;
import uz.reestr.mkd.backendjpa.dto.IntegrationRequestDtos.UnitSyncItem;
import uz.reestr.mkd.backendjpa.dto.IntegrationResponseDtos.SyncEntityResult;
import uz.reestr.mkd.backendjpa.dto.IntegrationResponseDtos.SyncResultResponse;

@Service
public class IntegrationJpaService {

  private final ObjectMapper objectMapper;

  @PersistenceContext
  private EntityManager entityManager;

  public IntegrationJpaService(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public JsonNode getIntegrationStatus(UUID projectId) {
    Object raw = entityManager.createNativeQuery("""
        select p.integration_data
          from projects p
         where p.id = :projectId
        """)
        .setParameter("projectId", projectId)
        .getResultStream()
        .findFirst()
        .orElse(null);

    if (raw == null) {
      return objectMapper.createObjectNode();
    }
    return objectMapper.valueToTree(raw);
  }

  @Transactional
  public JsonNode updateIntegrationStatus(UUID projectId, String field, String status) {
    if (field == null || field.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "field is required");
    }
    
    JsonNode current = getIntegrationStatus(projectId);
    @SuppressWarnings("unchecked")
    Map<String, Object> data = objectMapper.convertValue(current, Map.class);
    data.put(field, status);

    int updated = entityManager.createNativeQuery("""
        update projects
           set integration_data = cast(:integrationData as jsonb),
               updated_at = now()
         where id = :projectId
        """)
        .setParameter("integrationData", toJson(data))
        .setParameter("projectId", projectId)
        .executeUpdate();

    if (updated == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Project not found");
    }

    return objectMapper.valueToTree(data);
  }

  @Transactional
  public SyncEntityResult updateBuildingCadastre(UUID buildingId, String cadastre) {
    int updated = entityManager.createNativeQuery("""
        update buildings
           set cadastre_number = :cadastre,
               updated_at = now()
         where id = :id
        """)
        .setParameter("cadastre", normalizeCadastre(cadastre))
        .setParameter("id", buildingId)
        .executeUpdate();

    if (updated == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Building not found");
    }

    return new SyncEntityResult(buildingId, null, null, normalizeCadastre(cadastre));
  }

  @Transactional
  public SyncEntityResult updateUnitCadastre(UUID unitId, String cadastre) {
    int updated = entityManager.createNativeQuery("""
        update units
           set cadastre_number = :cadastre,
               updated_at = now()
         where id = :id
        """)
        .setParameter("cadastre", blankToNull(cadastre))
        .setParameter("id", unitId)
        .executeUpdate();

    if (updated == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found");
    }

    return new SyncEntityResult(unitId, null, null, blankToNull(cadastre));
  }

  @Transactional
  public SyncResultResponse syncBuildings(SyncBuildingsRequest request) {
    List<BuildingSyncItem> items = request == null || request.items() == null ? List.of() : request.items();
    List<SyncEntityResult> updated = new ArrayList<>();

    for (BuildingSyncItem item : items) {
      if (item == null || item.buildingId() == null) {
        continue;
      }
      int count = entityManager.createNativeQuery("""
          update buildings
             set external_id = coalesce(:externalId, external_id),
                 integration_status = coalesce(:integrationStatus, integration_status),
                 cadastre_number = coalesce(:cadastre, cadastre_number),
                 updated_at = now()
           where id = :id
          """)
          .setParameter("externalId", blankToNull(item.externalId()))
          .setParameter("integrationStatus", blankToNull(item.integrationStatus()))
          .setParameter("cadastre", normalizeCadastre(item.cadastre()))
          .setParameter("id", item.buildingId())
          .executeUpdate();

      if (count > 0) {
        updated.add(new SyncEntityResult(
            item.buildingId(),
            blankToNull(item.externalId()),
            blankToNull(item.integrationStatus()),
            normalizeCadastre(item.cadastre())
        ));
      }
    }

    return new SyncResultResponse(true, updated.size(), updated);
  }

  @Transactional
  public SyncResultResponse syncUnits(SyncUnitsRequest request) {
    List<UnitSyncItem> items = request == null || request.items() == null ? List.of() : request.items();
    List<SyncEntityResult> updated = new ArrayList<>();

    for (UnitSyncItem item : items) {
      if (item == null || item.unitId() == null) {
        continue;
      }
      int count = entityManager.createNativeQuery("""
          update units
             set external_id = coalesce(:externalId, external_id),
                 integration_status = coalesce(:integrationStatus, integration_status),
                 cadastre_number = coalesce(:cadastre, cadastre_number),
                 updated_at = now()
           where id = :id
          """)
          .setParameter("externalId", blankToNull(item.externalId()))
          .setParameter("integrationStatus", blankToNull(item.integrationStatus()))
          .setParameter("cadastre", blankToNull(item.cadastre()))
          .setParameter("id", item.unitId())
          .executeUpdate();

      if (count > 0) {
        updated.add(new SyncEntityResult(
            item.unitId(),
            blankToNull(item.externalId()),
            blankToNull(item.integrationStatus()),
            blankToNull(item.cadastre())
        ));
      }
    }

    return new SyncResultResponse(true, updated.size(), updated);
  }

  private String normalizeCadastre(String cadastre) {
    String raw = blankToNull(cadastre);
    if (raw == null) {
      return null;
    }
    String digits = raw.replaceAll("\\D", "");
    if (digits.isEmpty()) {
      return null;
    }
    int[] groups = {2, 2, 2, 2, 2, 4};
    StringBuilder out = new StringBuilder();
    int offset = 0;
    for (int group : groups) {
      if (offset >= digits.length()) {
        break;
      }
      int end = Math.min(digits.length(), offset + group);
      if (out.length() > 0) {
        out.append(':');
      }
      out.append(digits, offset, end);
      offset = end;
    }
    return out.toString();
  }

  private String blankToNull(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    return value.trim();
  }

  private String toJson(Object value) {
    try {
      return objectMapper.writeValueAsString(value);
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to serialize integration data");
    }
  }
}
