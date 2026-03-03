package uz.reestr.mkd.backendjpa.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileFloorsRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileUnitsForBlockRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.BatchUpsertMatrixCellsRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.MatrixCellInput;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.MatrixCellValues;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertMatrixCellRequest;
import uz.reestr.mkd.backendjpa.entity.EntranceEntity;
import uz.reestr.mkd.backendjpa.entity.EntranceMatrixEntity;
import uz.reestr.mkd.backendjpa.entity.FloorEntity;
import uz.reestr.mkd.backendjpa.entity.UnitEntity;

@Service
public class RegistryJpaService {

  @PersistenceContext
  private EntityManager entityManager;

  @Transactional
  public ReconcileUnitsResult reconcileUnitsForBlock(UUID blockId, ReconcileUnitsForBlockRequest request) {
    List<UUID> floorIds = getFloorIdsByBlock(blockId);
    if (floorIds.isEmpty()) {
      return new ReconcileUnitsResult(0, 0, 0);
    }

    Map<Integer, UUID> entranceByNumber = getEntranceByNumber(blockId);
    Map<CellKey, CellDemand> demandMap = getDemandByCell(blockId, entranceByNumber);
    Map<CellKey, ExistingUnitsBucket> existingByCell = getExistingUnitsByCell(floorIds);

    List<UUID> toDelete = new ArrayList<>();
    List<UnitPlan> toCreate = new ArrayList<>();
    int checkedCells = 0;

    Set<CellKey> allKeys = new HashSet<>();
    allKeys.addAll(existingByCell.keySet());
    allKeys.addAll(demandMap.keySet());

    for (CellKey key : allKeys) {
      checkedCells++;
      ExistingUnitsBucket existing = existingByCell.getOrDefault(key, new ExistingUnitsBucket());
      CellDemand demand = demandMap.getOrDefault(key, new CellDemand(0, 0));

      existing.flats.sort(Comparator.comparing(UnitLite::createdAt, Comparator.nullsLast(Comparator.naturalOrder())));
      existing.commercial.sort(Comparator.comparing(UnitLite::createdAt, Comparator.nullsLast(Comparator.naturalOrder())));

      if (existing.flats.size() > demand.flats()) {
        existing.flats.subList(demand.flats(), existing.flats.size()).forEach(unit -> toDelete.add(unit.id()));
      } else if (existing.flats.size() < demand.flats()) {
        int missing = demand.flats() - existing.flats.size();
        for (int i = 0; i < missing; i++) {
          toCreate.add(new UnitPlan(key.floorId(), key.entranceId(), "flat", i + 1));
        }
      }

      if (existing.commercial.size() > demand.commercial()) {
        existing.commercial.subList(demand.commercial(), existing.commercial.size()).forEach(unit -> toDelete.add(unit.id()));
      } else if (existing.commercial.size() < demand.commercial()) {
        int missing = demand.commercial() - existing.commercial.size();
        for (int i = 0; i < missing; i++) {
          toCreate.add(new UnitPlan(key.floorId(), key.entranceId(), "office", i + 1));
        }
      }
    }

    if (!toDelete.isEmpty()) {
      entityManager.createQuery("delete from UnitEntity u where u.id in :ids")
          .setParameter("ids", toDelete)
          .executeUpdate();
    }

    int created = 0;
    int batchCounter = 0;
    for (UnitPlan plan : toCreate) {
      UnitEntity entity = new UnitEntity();
      entity.setId(UUID.randomUUID());
      entity.setFloor(entityManager.getReference(FloorEntity.class, plan.floorId()));
      entity.setEntrance(entityManager.getReference(EntranceEntity.class, plan.entranceId()));
      entity.setUnitType(plan.unitType());
      entity.setNumber(plan.unitType().equals("flat") ? "Кв." + plan.sequence() : "Оф." + plan.sequence());
      entity.setHasMezzanine(false);
      entity.setRoomsCount(0);
      entity.setTotalArea(java.math.BigDecimal.ZERO);
      entity.setLivingArea(java.math.BigDecimal.ZERO);
      entity.setUsefulArea(java.math.BigDecimal.ZERO);
      entity.setStatus("free");
      entityManager.persist(entity);
      created++;
      batchCounter++;

      if (batchCounter % 50 == 0) {
        entityManager.flush();
        entityManager.clear();
      }
    }

    if (batchCounter % 50 != 0) {
      entityManager.flush();
      entityManager.clear();
    }

    return new ReconcileUnitsResult(toDelete.size(), checkedCells, created);
  }

  @Transactional
  public ReconcileFloorsResult reconcileFloors(UUID blockId, ReconcileFloorsRequest request) {
    if (request == null || request.floorsFrom() == null || request.floorsTo() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorsFrom and floorsTo are required");
    }
    if (request.floorsFrom() > request.floorsTo()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorsFrom cannot be greater than floorsTo");
    }

    List<FloorLite> existing = getFloorsLite(blockId);
    Map<Integer, FloorLite> byIndex = new HashMap<>();
    for (FloorLite row : existing) {
      byIndex.put(row.index(), row);
    }

    Set<Integer> targetIndexes = new HashSet<>();
    for (int idx = request.floorsFrom(); idx <= request.floorsTo(); idx++) {
      targetIndexes.add(idx);
      FloorLite current = byIndex.get(idx);
      if (current == null) {
        FloorEntity entity = new FloorEntity();
        entity.setId(UUID.randomUUID());
        entity.setBlock(entityManager.getReference(uz.reestr.mkd.backendjpa.entity.BlockEntity.class, blockId));
        entity.setFloorIndex(idx);
        entity.setFloorKey("floor:" + idx);
        entity.setLabel(idx + " этаж");
        entity.setFloorType(request.defaultType() == null ? "residential" : request.defaultType());
        entity.setAreaProj(java.math.BigDecimal.ZERO);
        entity.setAreaFact(java.math.BigDecimal.ZERO);
        entity.setIsTechnical(false);
        entity.setIsCommercial(false);
        entityManager.persist(entity);
      }
    }

    List<UUID> toDelete = new ArrayList<>();
    for (FloorLite row : existing) {
      if (!targetIndexes.contains(row.index())) {
        toDelete.add(row.id());
      }
    }
    if (!toDelete.isEmpty()) {
      entityManager.createQuery("delete from FloorEntity f where f.id in :ids")
          .setParameter("ids", toDelete)
          .executeUpdate();
    }

    recalculateBlockAreaAndMatrix(blockId);
    return new ReconcileFloorsResult(toDelete.size(), targetIndexes.size());
  }

  @Transactional
  public EntranceMatrixEntity upsertEntranceMatrixCell(UUID blockId, UpsertMatrixCellRequest request) {
    if (request == null || request.floorId() == null || request.entranceNumber() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorId and entranceNumber are required");
    }

    MatrixCellValues values = request.values();
    Integer flats = values == null ? null : nonNegative(values.apts(), "apts");
    Integer commercial = values == null ? null : nonNegative(values.units(), "units");
    Integer mop = values == null ? null : nonNegative(values.mopQty(), "mopQty");

    EntranceMatrixEntity row = findMatrixRow(blockId, request.floorId(), request.entranceNumber());
    if (row == null) {
      row = new EntranceMatrixEntity();
      row.setId(UUID.randomUUID());
      row.setBlock(entityManager.getReference(uz.reestr.mkd.backendjpa.entity.BlockEntity.class, blockId));
      row.setFloor(entityManager.getReference(FloorEntity.class, request.floorId()));
      row.setEntranceNumber(request.entranceNumber());
    }

    if (flats != null) {
      row.setFlatsCount(flats);
    }
    if (commercial != null) {
      row.setCommercialCount(commercial);
    }
    if (mop != null) {
      row.setMopCount(mop);
    }

    entityManager.merge(row);
    recalculateBlockAreaAndMatrix(blockId);
    return row;
  }

  @Transactional
  public BatchMatrixResult batchUpsertEntranceMatrixCells(UUID blockId, BatchUpsertMatrixCellsRequest request) {
    if (request == null || request.cells() == null || request.cells().isEmpty()) {
      return new BatchMatrixResult(0, List.of());
    }

    List<String> failed = new ArrayList<>();
    int updated = 0;
    for (int i = 0; i < request.cells().size(); i++) {
      MatrixCellInput cell = request.cells().get(i);
      try {
        upsertEntranceMatrixCell(blockId, new UpsertMatrixCellRequest(cell.floorId(), cell.entranceNumber(), cell.values()));
        updated++;
      } catch (ResponseStatusException ex) {
        failed.add("index=" + i + ": " + ex.getReason());
      }
    }
    recalculateBlockAreaAndMatrix(blockId);
    return new BatchMatrixResult(updated, failed);
  }

  @Transactional
  public void recalculateBlockAreaAndMatrix(UUID blockId) {
    Object sum = entityManager.createNativeQuery("""
        select coalesce(sum(coalesce(area_proj, 0)), 0)
          from floors
         where block_id = :blockId
        """)
        .setParameter("blockId", blockId)
        .getSingleResult();

    entityManager.createNativeQuery("""
        update building_blocks
           set block_footprint_area_m2 = :area,
               updated_at = now()
         where id = :blockId
        """)
        .setParameter("area", sum)
        .setParameter("blockId", blockId)
        .executeUpdate();

    ensureEntranceMatrixForBlock(blockId);
  }

  private void ensureEntranceMatrixForBlock(UUID blockId) {
    List<UUID> floorIds = getFloorIdsByBlock(blockId);
    List<Integer> entranceNumbers = getEntranceNumbersByBlock(blockId);

    if (floorIds.isEmpty() || entranceNumbers.isEmpty()) {
      entityManager.createNativeQuery("delete from entrance_matrix where block_id = :blockId")
          .setParameter("blockId", blockId)
          .executeUpdate();
      return;
    }

    List<Object[]> existingRows = entityManager.createNativeQuery("""
        select id, floor_id, entrance_number
          from entrance_matrix
         where block_id = :blockId
        """)
        .setParameter("blockId", blockId)
        .getResultList();

    Set<String> expected = new HashSet<>();
    for (UUID floorId : floorIds) {
      for (Integer entranceNumber : entranceNumbers) {
        expected.add(floorId + "|" + entranceNumber);
      }
    }

    Set<UUID> staleIds = new HashSet<>();
    Set<String> existingKeys = new HashSet<>();
    for (Object[] row : existingRows) {
      UUID id = (UUID) row[0];
      UUID floorId = (UUID) row[1];
      Integer entranceNumber = ((Number) row[2]).intValue();
      String key = floorId + "|" + entranceNumber;
      if (!expected.contains(key)) {
        staleIds.add(id);
      } else {
        existingKeys.add(key);
      }
    }

    if (!staleIds.isEmpty()) {
      entityManager.createQuery("delete from EntranceMatrixEntity em where em.id in :ids")
          .setParameter("ids", staleIds)
          .executeUpdate();
    }

    for (UUID floorId : floorIds) {
      for (Integer entranceNumber : entranceNumbers) {
        String key = floorId + "|" + entranceNumber;
        if (existingKeys.contains(key)) {
          continue;
        }
        EntranceMatrixEntity entity = new EntranceMatrixEntity();
        entity.setId(UUID.randomUUID());
        entity.setBlock(entityManager.getReference(uz.reestr.mkd.backendjpa.entity.BlockEntity.class, blockId));
        entity.setFloor(entityManager.getReference(FloorEntity.class, floorId));
        entity.setEntranceNumber(entranceNumber);
        entity.setFlatsCount(0);
        entity.setCommercialCount(0);
        entity.setMopCount(0);
        entityManager.persist(entity);
      }
    }
  }

  private Integer nonNegative(Integer value, String field) {
    if (value == null) {
      return null;
    }
    if (value < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be non-negative");
    }
    return value;
  }

  private EntranceMatrixEntity findMatrixRow(UUID blockId, UUID floorId, Integer entranceNumber) {
    List<EntranceMatrixEntity> rows = entityManager
        .createQuery("""
            select em
              from EntranceMatrixEntity em
             where em.block.id = :blockId
               and em.floor.id = :floorId
               and em.entranceNumber = :entranceNumber
            """, EntranceMatrixEntity.class)
        .setParameter("blockId", blockId)
        .setParameter("floorId", floorId)
        .setParameter("entranceNumber", entranceNumber)
        .setMaxResults(1)
        .getResultList();
    return rows.isEmpty() ? null : rows.get(0);
  }

  private Map<CellKey, ExistingUnitsBucket> getExistingUnitsByCell(List<UUID> floorIds) {
    List<Object[]> rows = entityManager.createQuery("""
        select u.id, u.floor.id, u.entrance.id, u.unitType, u.createdAt
          from UnitEntity u
         where u.floor.id in :floorIds
        """, Object[].class)
        .setParameter("floorIds", floorIds)
        .getResultList();

    Map<CellKey, ExistingUnitsBucket> out = new HashMap<>();
    for (Object[] row : rows) {
      UUID id = (UUID) row[0];
      UUID floorId = (UUID) row[1];
      UUID entranceId = (UUID) row[2];
      String unitType = (String) row[3];
      OffsetDateTime createdAt = (OffsetDateTime) row[4];
      if (entranceId == null) {
        continue;
      }

      CellKey key = new CellKey(floorId, entranceId);
      out.putIfAbsent(key, new ExistingUnitsBucket());
      UnitLite unit = new UnitLite(id, createdAt);

      if (isFlat(unitType)) {
        out.get(key).flats.add(unit);
      } else if (isCommercial(unitType)) {
        out.get(key).commercial.add(unit);
      }
    }
    return out;
  }

  private Map<CellKey, CellDemand> getDemandByCell(UUID blockId, Map<Integer, UUID> entranceByNumber) {
    List<EntranceMatrixEntity> rows = entityManager.createQuery("""
        select em
          from EntranceMatrixEntity em
         where em.block.id = :blockId
        """, EntranceMatrixEntity.class)
        .setParameter("blockId", blockId)
        .getResultList();

    Map<CellKey, CellDemand> demand = new HashMap<>();
    for (EntranceMatrixEntity row : rows) {
      UUID entranceId = entranceByNumber.get(row.getEntranceNumber());
      if (entranceId == null || row.getFloor() == null || row.getFloor().getId() == null) {
        continue;
      }
      CellKey key = new CellKey(row.getFloor().getId(), entranceId);
      demand.put(key, new CellDemand(
          Math.max(0, row.getFlatsCount() == null ? 0 : row.getFlatsCount()),
          Math.max(0, row.getCommercialCount() == null ? 0 : row.getCommercialCount())
      ));
    }
    return demand;
  }

  private List<UUID> getFloorIdsByBlock(UUID blockId) {
    return entityManager.createQuery("select f.id from FloorEntity f where f.block.id = :blockId", UUID.class)
        .setParameter("blockId", blockId)
        .getResultList();
  }

  private List<Integer> getEntranceNumbersByBlock(UUID blockId) {
    return entityManager.createQuery("select e.number from EntranceEntity e where e.block.id = :blockId", Integer.class)
        .setParameter("blockId", blockId)
        .getResultList();
  }

  private Map<Integer, UUID> getEntranceByNumber(UUID blockId) {
    List<Object[]> rows = entityManager.createQuery(
            "select e.number, e.id from EntranceEntity e where e.block.id = :blockId", Object[].class)
        .setParameter("blockId", blockId)
        .getResultList();
    Map<Integer, UUID> out = new HashMap<>();
    for (Object[] row : rows) {
      out.put((Integer) row[0], (UUID) row[1]);
    }
    return out;
  }

  private List<FloorLite> getFloorsLite(UUID blockId) {
    List<Object[]> rows = entityManager.createQuery(
            "select f.id, f.floorIndex from FloorEntity f where f.block.id = :blockId", Object[].class)
        .setParameter("blockId", blockId)
        .getResultList();
    List<FloorLite> out = new ArrayList<>();
    for (Object[] row : rows) {
      out.add(new FloorLite((UUID) row[0], (Integer) row[1]));
    }
    return out;
  }

  private boolean isFlat(String unitType) {
    return "flat".equals(unitType) || "duplex_up".equals(unitType) || "duplex_down".equals(unitType);
  }

  private boolean isCommercial(String unitType) {
    return "office".equals(unitType)
        || "office_inventory".equals(unitType)
        || "non_res_block".equals(unitType)
        || "infrastructure".equals(unitType);
  }

  private record CellKey(UUID floorId, UUID entranceId) {
  }

  private record CellDemand(int flats, int commercial) {
  }

  private record UnitLite(UUID id, OffsetDateTime createdAt) {
  }

  private record UnitPlan(UUID floorId, UUID entranceId, String unitType, int sequence) {
  }

  private record FloorLite(UUID id, Integer index) {
  }

  private static final class ExistingUnitsBucket {

    private final List<UnitLite> flats = new ArrayList<>();
    private final List<UnitLite> commercial = new ArrayList<>();
  }

  public record ReconcileUnitsResult(int removed, int checkedCells, int created) {
  }

  public record ReconcileFloorsResult(int deleted, int upserted) {
  }

  public record BatchMatrixResult(int updated, List<String> failed) {
  }
}
