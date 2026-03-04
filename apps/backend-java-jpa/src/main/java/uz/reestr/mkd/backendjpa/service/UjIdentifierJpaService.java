package uz.reestr.mkd.backendjpa.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class UjIdentifierJpaService {

  private static final Map<String, String> BUILDING_PREFIXES = Map.of(
      "residential", "ZR",
      "residential_multiblock", "ZM",
      "parking_separate", "ZP",
      "parking_integrated", "ZP",
      "infrastructure", "ZI"
  );

  private static final Map<String, String> UNIT_PREFIXES = Map.of(
      "flat", "EF",
      "duplex_up", "EF",
      "duplex_down", "EF",
      "office", "EO",
      "office_inventory", "EO",
      "non_res_block", "EO",
      "infrastructure", "EO",
      "parking_place", "EP"
  );

  @PersistenceContext
  private EntityManager entityManager;

  public String generateBuildingCode(UUID projectId, String category, boolean hasMultipleBlocks) {
    String prefix = resolveBuildingPrefix(category, hasMultipleBlocks);

    Number max = (Number) entityManager.createNativeQuery("""
        select coalesce(max(cast(substring(b.building_code from '[0-9]+$') as integer)), 0)
          from buildings b
         where b.project_id = :projectId
           and b.building_code is not null
           and b.building_code like concat(:prefix, '%')
        """)
        .setParameter("projectId", projectId)
        .setParameter("prefix", prefix)
        .getSingleResult();

    int next = (max == null ? 0 : max.intValue()) + 1;
    return prefix + String.format("%02d", next);
  }

  public String generateUnitCode(UUID blockId, String unitType) {
    String prefix = UNIT_PREFIXES.getOrDefault(unitType, "EF");

    Number max = (Number) entityManager.createNativeQuery("""
        select coalesce(max(cast(substring(u.unit_code from '[0-9]+$') as integer)), 0)
          from units u
          join floors f on f.id = u.floor_id
         where f.block_id = :blockId
           and u.unit_code is not null
           and u.unit_code like concat(:prefix, '%')
        """)
        .setParameter("blockId", blockId)
        .setParameter("prefix", prefix)
        .getSingleResult();

    int next = (max == null ? 0 : max.intValue()) + 1;
    return prefix + String.format("%04d", next);
  }

  private String resolveBuildingPrefix(String category, boolean hasMultipleBlocks) {
    if ("residential".equals(category) || "residential_multiblock".equals(category)) {
      if ("residential_multiblock".equals(category)) {
        return "ZM";
      }
      return hasMultipleBlocks ? "ZM" : "ZR";
    }
    return BUILDING_PREFIXES.getOrDefault(category, "ZR");
  }
}
