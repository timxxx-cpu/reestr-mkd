package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CalculationsJpaService {

  @PersistenceContext
  private EntityManager entityManager;

  private final ObjectMapper objectMapper;

  public CalculationsJpaService(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  @Transactional(readOnly = true)
  public TEPAggregate calculateBlock(UUID blockId) {
    BigDecimal flats = sumUnitAreaByBlockAndTypes(blockId, true);
    BigDecimal offices = sumUnitAreaByBlockAndTypes(blockId, false);
    BigDecimal mops = sumMopAreaByBlock(blockId);
    return new TEPAggregate(flats, offices, mops);
  }

  @Transactional(readOnly = true)
  public TEPAggregate calculateBuilding(UUID buildingId) {
    BigDecimal flats = sumUnitAreaByBuildingAndTypes(buildingId, true);
    BigDecimal offices = sumUnitAreaByBuildingAndTypes(buildingId, false);
    BigDecimal mops = sumMopAreaByBuilding(buildingId);
    return new TEPAggregate(flats, offices, mops);
  }

  @Transactional(readOnly = true)
  public TEPAggregate calculateProject(UUID projectId) {
    BigDecimal flats = sumUnitAreaByProjectAndTypes(projectId, true);
    BigDecimal offices = sumUnitAreaByProjectAndTypes(projectId, false);
    BigDecimal mops = sumMopAreaByProject(projectId);
    return new TEPAggregate(flats, offices, mops);
  }

  public void recalculateProjectAfterCommit(UUID projectId) {
    if (projectId == null) {
      return;
    }
    if (TransactionSynchronizationManager.isActualTransactionActive()) {
      TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
        @Override
        public void afterCommit() {
          persistProjectTepSummary(projectId);
        }
      });
      return;
    }
    persistProjectTepSummary(projectId);
  }

  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public void persistProjectTepSummary(UUID projectId) {
    TEPAggregate agg = calculateProject(projectId);

    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("livingAreaProj", agg.flatsArea());
    payload.put("commercialArea", agg.officesArea());
    payload.put("mopArea", agg.mopArea());
    payload.put("totalObjectsArea", agg.totalArea());

    String json;
    try {
      json = objectMapper.writeValueAsString(payload);
    } catch (Exception ex) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Failed to serialize TEP payload");
    }

    entityManager.createNativeQuery("""
        update projects
           set integration_data = coalesce(integration_data, '{}'::jsonb) || jsonb_build_object('tepSummary', cast(:tepSummary as jsonb)),
               updated_at = now()
         where id = :projectId
        """)
        .setParameter("tepSummary", json)
        .setParameter("projectId", projectId)
        .executeUpdate();
  }

  private BigDecimal sumUnitAreaByBlockAndTypes(UUID blockId, boolean flats) {
    String condition = flats
        ? "u.unitType in ('flat', 'duplex_up', 'duplex_down')"
        : "u.unitType in ('office', 'office_inventory', 'non_res_block', 'infrastructure')";
    return (BigDecimal) entityManager.createQuery(
            "select coalesce(sum(coalesce(u.totalArea, 0)), 0) from UnitEntity u where u.block.id = :blockId and " + condition)
        .setParameter("blockId", blockId)
        .getSingleResult();
  }

  private BigDecimal sumUnitAreaByBuildingAndTypes(UUID buildingId, boolean flats) {
    String condition = flats
        ? "u.unitType in ('flat', 'duplex_up', 'duplex_down')"
        : "u.unitType in ('office', 'office_inventory', 'non_res_block', 'infrastructure')";
    return (BigDecimal) entityManager.createQuery(
            "select coalesce(sum(coalesce(u.totalArea, 0)), 0) from UnitEntity u where u.block.building.id = :buildingId and " + condition)
        .setParameter("buildingId", buildingId)
        .getSingleResult();
  }

  private BigDecimal sumUnitAreaByProjectAndTypes(UUID projectId, boolean flats) {
    String condition = flats
        ? "u.unitType in ('flat', 'duplex_up', 'duplex_down')"
        : "u.unitType in ('office', 'office_inventory', 'non_res_block', 'infrastructure')";
    return (BigDecimal) entityManager.createQuery(
            "select coalesce(sum(coalesce(u.totalArea, 0)), 0) from UnitEntity u where u.block.building.projectId = :projectId and " + condition)
        .setParameter("projectId", projectId)
        .getSingleResult();
  }

  private BigDecimal sumMopAreaByBlock(UUID blockId) {
    return (BigDecimal) entityManager.createQuery(
            "select coalesce(sum(coalesce(ca.area, 0)), 0) from CommonAreaEntity ca where ca.floor.block.id = :blockId")
        .setParameter("blockId", blockId)
        .getSingleResult();
  }

  private BigDecimal sumMopAreaByBuilding(UUID buildingId) {
    return (BigDecimal) entityManager.createQuery(
            "select coalesce(sum(coalesce(ca.area, 0)), 0) from CommonAreaEntity ca where ca.floor.block.building.id = :buildingId")
        .setParameter("buildingId", buildingId)
        .getSingleResult();
  }

  private BigDecimal sumMopAreaByProject(UUID projectId) {
    return (BigDecimal) entityManager.createQuery(
            "select coalesce(sum(coalesce(ca.area, 0)), 0) from CommonAreaEntity ca where ca.floor.block.building.projectId = :projectId")
        .setParameter("projectId", projectId)
        .getSingleResult();
  }

  public record TEPAggregate(BigDecimal flatsArea, BigDecimal officesArea, BigDecimal mopArea) {
    public BigDecimal totalArea() {
      return flatsArea.add(officesArea).add(mopArea);
    }
  }
}
