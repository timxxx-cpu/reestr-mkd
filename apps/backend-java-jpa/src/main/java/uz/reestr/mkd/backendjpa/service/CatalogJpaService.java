package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.CatalogRequestDtos.SetCatalogItemActiveRequest;
import uz.reestr.mkd.backendjpa.dto.CatalogRequestDtos.UpsertCatalogItemRequest;
import uz.reestr.mkd.backendjpa.dto.CatalogResponseDtos.CatalogItemsResponse;
import uz.reestr.mkd.backendjpa.dto.CatalogResponseDtos.SetCatalogItemActiveResponse;
import uz.reestr.mkd.backendjpa.dto.CatalogResponseDtos.SystemUsersResponse;
import uz.reestr.mkd.backendjpa.dto.CatalogResponseDtos.UpsertCatalogItemResponse;
import uz.reestr.mkd.backendjpa.entity.SystemUser;
import uz.reestr.mkd.backendjpa.repository.SystemUserRepository;

@Service
public class CatalogJpaService {

  private static final Set<String> ALLOWED_CATALOG_TABLES = Set.of(
      "dict_project_statuses",
      "dict_application_statuses",
      "dict_external_systems",
      "dict_foundations",
      "dict_wall_materials",
      "dict_slab_types",
      "dict_roof_types",
      "dict_light_structure_types",
      "dict_parking_types",
      "dict_parking_construction_types",
      "dict_infra_types",
      "dict_mop_types",
      "dict_unit_types",
      "dict_room_types",
      "dict_system_users",
      "regions",
      "districts",
      "streets",
      "makhallas"
  );

  private final SystemUserRepository systemUserRepository;
  private final ObjectMapper objectMapper;

  @PersistenceContext
  private EntityManager entityManager;

  public CatalogJpaService(SystemUserRepository systemUserRepository, ObjectMapper objectMapper) {
    this.systemUserRepository = systemUserRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public CatalogItemsResponse getCatalog(String table, Boolean activeOnly) {
    String resolvedTable = normalizeAndValidateTable(table);
    List<Map<String, Object>> rows = fetchCatalogRows(resolvedTable, Boolean.TRUE.equals(activeOnly));
    return new CatalogItemsResponse(rows.stream().map(row -> (JsonNode) objectMapper.valueToTree(row)).toList());
  }

  @Transactional(readOnly = true)
  public CatalogItemsResponse getCatalogAll(String table) {
    String resolvedTable = normalizeAndValidateTable(table);
    List<Map<String, Object>> rows = fetchCatalogRows(resolvedTable, false);
    return new CatalogItemsResponse(rows.stream().map(row -> (JsonNode) objectMapper.valueToTree(row)).toList());
  }

  @Transactional(readOnly = true)
  public SystemUsersResponse getSystemUsers(Boolean activeOnly) {
    List<SystemUser> users = systemUserRepository.findAll();
    List<SystemUser> filtered = users.stream()
        .filter(u -> !Boolean.TRUE.equals(activeOnly) || Boolean.TRUE.equals(u.getIsActive()))
        .sorted(Comparator.comparing(SystemUser::getName, Comparator.nullsLast(String::compareToIgnoreCase)))
        .toList();

    List<JsonNode> payload = filtered.stream()
        .map(user -> {
          Map<String, Object> row = new LinkedHashMap<>();
          row.put("id", user.getId());
          row.put("code", user.getCode());
          row.put("name", user.getName());
          row.put("role", user.getRole());
          row.put("group_name", user.getGroupName());
          row.put("sort_order", user.getSortOrder());
          row.put("is_active", user.getIsActive());
          return (JsonNode) objectMapper.valueToTree(row);
        })
        .toList();

    return new SystemUsersResponse(payload);
  }

  @Transactional
  public UpsertCatalogItemResponse upsertCatalogItem(String table, UpsertCatalogItemRequest request) {
    String resolvedTable = normalizeAndValidateTable(table);
    JsonNode item = request == null ? null : request.item();
    if (item == null || item.isNull() || !item.isObject()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Body must include an item object");
    }

    String id = trim(item.path("id").asText(null));
    if (id == null || id.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "item.id is required");
    }
    
    @SuppressWarnings("unchecked")
    Map<String, Object> payload = new LinkedHashMap<>(objectMapper.convertValue(item, Map.class));
    payload.put("id", id);
    if (payload.containsKey("sortOrder") && !payload.containsKey("sort_order")) {
      payload.put("sort_order", payload.get("sortOrder"));
    }
    if (payload.containsKey("isActive") && !payload.containsKey("is_active")) {
      payload.put("is_active", payload.get("isActive"));
    }

    List<String> columns = getTableColumns(resolvedTable);
    List<String> selectedColumns = payload.keySet().stream().filter(columns::contains).toList();
    if (selectedColumns.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Catalog payload does not contain writable fields");
    }

    String insertColumns = String.join(", ", selectedColumns);
    String values = String.join(", ", selectedColumns.stream().map(c -> ":" + c).toList());
    String updates = String.join(", ", selectedColumns.stream()
        .filter(c -> !"id".equals(c))
        .map(c -> c + " = excluded." + c)
        .toList());

    String sql = "insert into " + resolvedTable + "(" + insertColumns + ") values (" + values + ") "
        + "on conflict (id) do update set " + (updates.isBlank() ? "id = excluded.id" : updates);

    var query = entityManager.createNativeQuery(sql);
    for (String column : selectedColumns) {
      query.setParameter(column, payload.get(column));
    }
    query.executeUpdate();

    JsonNode out = objectMapper.valueToTree(payload);
    return new UpsertCatalogItemResponse(out);
  }

  @Transactional
  public SetCatalogItemActiveResponse setCatalogItemActive(String table, String id, SetCatalogItemActiveRequest request) {
    String resolvedTable = normalizeAndValidateTable(table);
    if (request == null || request.isActive() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "isActive must be a boolean");
    }

    String normalizedId = trim(id);
    if (normalizedId == null || normalizedId.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "id is required");
    }

    String flagColumn = resolvedTable.startsWith("dict_") ? "is_active" : "status";
    Object flagValue = resolvedTable.startsWith("dict_") ? request.isActive() : (request.isActive() ? 1 : 0);

    int updated = entityManager.createNativeQuery(
            "update " + resolvedTable + " set " + flagColumn + " = :active where id = :id")
        .setParameter("active", flagValue)
        .setParameter("id", normalizedId)
        .executeUpdate();

    if (updated == 0) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Catalog item not found");
    }

    return new SetCatalogItemActiveResponse(normalizedId, request.isActive());
  }

  private String normalizeAndValidateTable(String table) {
    String normalized = trim(table);
    if (normalized == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Таблица не разрешена");
    }
    normalized = normalized.toLowerCase(Locale.ROOT);
    if (!ALLOWED_CATALOG_TABLES.contains(normalized)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Таблица не разрешена");
    }
    return normalized;
  }

  private List<Map<String, Object>> fetchCatalogRows(String table, boolean activeOnly) {
    StringBuilder sql = new StringBuilder("select * from ").append(table);
    if (activeOnly) {
      if (table.startsWith("dict_")) {
        sql.append(" where is_active = true");
      } else {
        sql.append(" where status = 1");
      }
    }

    if ("dict_system_users".equals(table)) {
      sql.append(" order by name asc");
    } else if ("regions".equals(table) || "districts".equals(table)) {
      sql.append(" order by ordering asc, name_ru asc");
    } else if ("streets".equals(table) || "makhallas".equals(table)) {
      sql.append(" order by name asc");
    } else {
      sql.append(" order by sort_order asc, label asc");
    }
    @SuppressWarnings("unchecked")
    List<Object[]> tuples = entityManager.createNativeQuery(sql.toString()).getResultList();
    List<String> columns = getTableColumns(table);

    List<Map<String, Object>> out = new ArrayList<>();
    for (Object[] tuple : tuples) {
      Map<String, Object> row = new LinkedHashMap<>();
      for (int i = 0; i < tuple.length && i < columns.size(); i++) {
        row.put(columns.get(i), tuple[i]);
      }
      out.add(row);
    }
    return out;
  }

  private List<String> getTableColumns(String table) {
    List<?> rows = entityManager.createNativeQuery("""
        select column_name
          from information_schema.columns
         where table_schema = current_schema()
           and table_name = :table
         order by ordinal_position
        """)
        .setParameter("table", table)
        .getResultList();

    return rows.stream().map(String::valueOf).toList();
  }

  private String trim(String value) {
    return value == null ? null : value.trim();
  }
}
