package uz.reestr.mkd.backendjpa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileEntrancesRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileFloorsOptions;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileFloorsRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.ReconcileUnitsForBlockRequest;
import uz.reestr.mkd.backendjpa.dto.CompositionRequestDtos.FloorTemplateRule;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.BatchUpsertMatrixCellsRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.MatrixCellInput;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.MatrixCellValues;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertCommonAreaRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertUnitRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpdateFloorRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.CreateBlockExtensionRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpdateBlockExtensionRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertMatrixCellRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryRequestDtos.UpsertRoomRequest;
import uz.reestr.mkd.backendjpa.dto.RegistryResponseDtos.BatchUpsertMatrixCellsResponse;
import uz.reestr.mkd.backendjpa.entity.CommonAreaEntity;
import uz.reestr.mkd.backendjpa.entity.EntranceEntity;
import uz.reestr.mkd.backendjpa.entity.EntranceMatrixEntity;
import uz.reestr.mkd.backendjpa.entity.FloorEntity;
import uz.reestr.mkd.backendjpa.entity.RoomEntity;
import uz.reestr.mkd.backendjpa.entity.UnitEntity;
import uz.reestr.mkd.backendjpa.entity.BlockEntity;
import uz.reestr.mkd.backendjpa.entity.BlockExtensionEntity;
import uz.reestr.mkd.backendjpa.repository.FloorRepository;
import uz.reestr.mkd.backendjpa.repository.BlockRepository;

@Service
public class RegistryJpaService {

  private static final int BATCH_SIZE = 50;
  private static final int MAX_MATRIX_VALUE = 500;

  private final FloorRepository floorRepository;
  private final BlockRepository blockRepository;
  private final UjIdentifierJpaService ujIdentifierJpaService;
  private final ObjectMapper objectMapper;
  private final CalculationsJpaService calculationsJpaService;

  @PersistenceContext
  private EntityManager entityManager;

  public RegistryJpaService(
      FloorRepository floorRepository,
      BlockRepository blockRepository,
      UjIdentifierJpaService ujIdentifierJpaService,
      ObjectMapper objectMapper,
      CalculationsJpaService calculationsJpaService
  ) {
    this.floorRepository = floorRepository;
    this.blockRepository = blockRepository;
    this.ujIdentifierJpaService = ujIdentifierJpaService;
    this.objectMapper = objectMapper;
    this.calculationsJpaService = calculationsJpaService;
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getCommonAreas(UUID blockId, List<UUID> floorIds) {
    List<UUID> targetFloorIds = resolveBlockFloorIds(blockId, floorIds);
    if (targetFloorIds.isEmpty()) {
      return List.of();
    }

    List<CommonAreaEntity> rows = entityManager.createQuery(
            "select ca from CommonAreaEntity ca where ca.floor.id in :floorIds", CommonAreaEntity.class)
        .setParameter("floorIds", targetFloorIds)
        .getResultList();

    return rows.stream()
        .map(this::commonAreaToJson)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getRoomsByUnit(UUID unitId) {
    List<RoomEntity> rooms = entityManager.createQuery(
            "select r from RoomEntity r where r.unit.id = :unitId order by r.createdAt asc, r.id asc", RoomEntity.class)
        .setParameter("unitId", unitId)
        .getResultList();

    return rooms.stream()
        .map(this::roomToJson)
        .toList();
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getBlockExtensions(UUID blockId) {
    List<BlockExtensionEntity> rows = entityManager.createQuery(
            "select e from BlockExtensionEntity e where e.parentBlock.id = :blockId", BlockExtensionEntity.class)
        .setParameter("blockId", blockId)
        .getResultList();
    return rows.stream().map(this::extensionToJson).toList();
  }

  @Transactional
  public JsonNode createBlockExtension(UUID blockId, CreateBlockExtensionRequest request) {
    BlockEntity block = getBlock(blockId);
    var data = request == null ? null : request.extensionData();
    BlockExtensionEntity e = BlockExtensionEntity.builder()
        .building(block.getBuilding())
        .parentBlock(block)
        .label(data == null || data.label() == null ? "Extension" : data.label())
        .extensionType(data == null || data.extensionType() == null ? "annex" : data.extensionType())
        .constructionKind(data == null || data.constructionKind() == null ? "capital" : data.constructionKind())
        .floorsCount(data == null || data.floorsCount() == null ? 1 : data.floorsCount())
        .startFloorIndex(data == null || data.startFloorIndex() == null ? 1 : data.startFloorIndex())
        .verticalAnchorType(data == null || data.verticalAnchorType() == null ? "block" : data.verticalAnchorType())
        .anchorFloorKey(data == null ? null : data.anchorFloorKey())
        .notes(data == null ? null : data.notes())
        .build();
    entityManager.persist(e);
    return extensionToJson(e);
  }

  @Transactional
  public JsonNode updateBlockExtension(UUID extensionId, UpdateBlockExtensionRequest request) {
    BlockExtensionEntity e = entityManager.find(BlockExtensionEntity.class, extensionId);
    if (e == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Extension not found");
    }
    var data = request == null ? null : request.extensionData();
    if (data != null) {
      e.setLabel(data.label());
      e.setExtensionType(data.extensionType());
      e.setConstructionKind(data.constructionKind());
      e.setFloorsCount(data.floorsCount());
      e.setStartFloorIndex(data.startFloorIndex());
      e.setVerticalAnchorType(data.verticalAnchorType());
      e.setAnchorFloorKey(data.anchorFloorKey());
      e.setNotes(data.notes());
    }
    return extensionToJson(e);
  }

  @Transactional
  public void deleteBlockExtension(UUID extensionId) {
    entityManager.createQuery("delete from BlockExtensionEntity e where e.id = :id")
        .setParameter("id", extensionId)
        .executeUpdate();
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getFloors(UUID blockId) {
    return entityManager.createQuery("select f from FloorEntity f where f.block.id = :blockId order by f.floorIndex", FloorEntity.class)
        .setParameter("blockId", blockId)
        .getResultList().stream().map(this::floorToJson).toList();
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getEntrances(UUID blockId) {
    return entityManager.createQuery("select e from EntranceEntity e where e.block.id = :blockId order by e.number", EntranceEntity.class)
        .setParameter("blockId", blockId)
        .getResultList().stream().map(this::entranceToJson).toList();
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getEntranceMatrix(UUID blockId) {
    return entityManager.createQuery("select m from EntranceMatrixEntity m where m.block.id = :blockId", EntranceMatrixEntity.class)
        .setParameter("blockId", blockId)
        .getResultList().stream().map(this::matrixToJson).toList();
  }

  @Transactional(readOnly = true)
  public JsonNode getUnitExplication(UUID unitId) {
    UnitEntity unit = entityManager.find(UnitEntity.class, unitId);
    if (unit == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found");
    }
    return unitToJson(unit);
  }

  @Transactional(readOnly = true)
  public List<JsonNode> getUnits(UUID blockId, List<UUID> floorIds) {
    String q = "select u from UnitEntity u where u.block.id = :blockId";
    if (floorIds != null && !floorIds.isEmpty()) {
      q += " and u.floor.id in :floorIds";
    }
    var query = entityManager.createQuery(q, UnitEntity.class).setParameter("blockId", blockId);
    if (floorIds != null && !floorIds.isEmpty()) {
      query.setParameter("floorIds", floorIds);
    }
    return query.getResultList().stream().map(this::unitToJson).toList();
  }

  @Transactional
  public JsonNode upsertUnit(UpsertUnitRequest request) {
    UnitEntity unit = request.id() == null ? new UnitEntity() : entityManager.find(UnitEntity.class, request.id());
    if (unit == null) {
      unit = new UnitEntity();
    }
    FloorEntity floor = entityManager.find(FloorEntity.class, request.floorId());
    unit.setFloor(floor);
    unit.setEntrance(request.entranceId() == null ? null : entityManager.find(EntranceEntity.class, request.entranceId()));
    unit.setNumber(request.num());
    unit.setTotalArea(request.area());
    unit.setUnitType(request.type() == null ? "apartment" : request.type());
    unit.setRoomsCount(request.rooms());
    unit.setHasMezzanine(false);
    if (unit.getStatus() == null) {
      unit.setStatus("draft");
    }
    unit = entityManager.merge(unit);
    return unitToJson(unit);
  }

  @Transactional
  public JsonNode updateFloor(UUID floorId, UpdateFloorRequest request) {
    FloorEntity floor = entityManager.find(FloorEntity.class, floorId);
    if (floor == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Floor not found");
    }
    var u = request == null ? null : request.updates();
    if (u != null) {
      floor.setFloorKey(u.floorKey());
      floor.setHeight(u.height());
      floor.setAreaProj(u.areaProj());
      floor.setAreaFact(u.areaFact());
      floor.setIsDuplex(u.isDuplex());
      floor.setFloorIndex(u.levelIndex());
      floor.setParentFloorIndex(u.parentFloorIndex());
      floor.setBasementId(u.basementId());
    }
    return floorToJson(floor);
  }

  @Transactional
  public JsonNode upsertRoom(UUID unitId, UUID roomId, UpsertRoomRequest request) {
    if (request == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Room payload is required");
    }

    RoomEntity entity;
    UUID targetUnitId = unitId;

    if (roomId != null) {
      entity = entityManager.find(RoomEntity.class, roomId);
      if (entity == null) {
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found");
      }
      if (targetUnitId == null) {
        targetUnitId = entity.getUnit().getId();
      }
    } else {
      if (targetUnitId == null) {
        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unitId is required");
      }
      entity = new RoomEntity();
      entity.setId(request.id() == null ? UUID.randomUUID() : request.id());
    }

    entity.setUnit(entityManager.getReference(UnitEntity.class, targetUnitId));
    entity.setRoomType(request.type());
    entity.setName(request.label());
    entity.setArea(request.area());
    entity.setRoomHeight(request.height());
    entity.setLevel(request.level() == null ? 1 : request.level());
    entity.setIsMezzanine(Boolean.TRUE.equals(request.isMezzanine()));

    if (roomId == null) {
      entityManager.persist(entity);
    }

    recalculateUnitAreas(targetUnitId);
    return roomToJson(entity);
  }

  @Transactional
  public void deleteRoom(UUID roomId) {
    RoomEntity entity = entityManager.find(RoomEntity.class, roomId);
    if (entity == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Room not found");
    }

    UUID unitId = entity.getUnit().getId();
    entityManager.remove(entity);
    recalculateUnitAreas(unitId);
  }

  @Transactional(readOnly = true)
  public JsonNode getBlockHierarchy(UUID blockId) {
    BlockEntity block = blockRepository.findWithGraphById(blockId)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Block not found"));

    ObjectNode root = objectMapper.createObjectNode();
    root.put("id", block.getId().toString());
    root.put("label", block.getLabel());
    root.put("type", block.getType());

    ArrayNode entrances = objectMapper.createArrayNode();
    block.getEntrances().stream()
        .sorted(Comparator.comparing(EntranceEntity::getNumber, Comparator.nullsLast(Integer::compareTo)))
        .forEach(e -> {
          ObjectNode node = objectMapper.createObjectNode();
          node.put("id", e.getId() == null ? null : e.getId().toString());
          node.put("number", e.getNumber());
          entrances.add(node);
        });
    root.set("entrances", entrances);

    ArrayNode floors = objectMapper.createArrayNode();
    block.getFloors().stream()
        .sorted(Comparator.comparing(FloorEntity::getFloorIndex, Comparator.nullsLast(Integer::compareTo)))
        .forEach(floor -> {
          ObjectNode f = objectMapper.createObjectNode();
          f.put("id", floor.getId() == null ? null : floor.getId().toString());
          f.put("index", floor.getFloorIndex());
          f.put("floor_key", floor.getFloorKey());
          f.put("label", floor.getLabel());
          f.put("floor_type", floor.getFloorType());

          ArrayNode units = objectMapper.createArrayNode();
          floor.getUnits().stream()
              .sorted(Comparator.comparing(UnitEntity::getNumber, Comparator.nullsLast(String::compareTo)))
              .forEach(u -> {
                ObjectNode unit = objectMapper.createObjectNode();
                unit.put("id", u.getId() == null ? null : u.getId().toString());
                unit.put("number", u.getNumber());
                unit.put("unit_type", u.getUnitType());
                unit.put("total_area", u.getTotalArea() == null ? null : u.getTotalArea().doubleValue());
                unit.put("rooms_count", u.getRoomsCount());
                units.add(unit);
              });
          f.set("units", units);

          ArrayNode rooms = objectMapper.createArrayNode();
          floor.getCommonAreas().stream()
              .sorted(Comparator.comparing(CommonAreaEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
              .forEach(ca -> {
                ObjectNode room = objectMapper.createObjectNode();
                room.put("id", ca.getId() == null ? null : ca.getId().toString());
                room.put("type", ca.getType());
                room.put("entrance_id", ca.getEntrance() == null ? null : ca.getEntrance().getId().toString());
                room.put("area", ca.getArea() == null ? null : ca.getArea().doubleValue());
                room.put("height", ca.getHeight() == null ? null : ca.getHeight().doubleValue());
                rooms.add(room);
              });
          f.set("rooms", rooms);

          floors.add(f);
        });
    root.set("floors", floors);
    return root;
  }

  @Transactional
  public ReconcileCommonAreasResult reconcileCommonAreasForBlock(UUID blockId) {
    List<UUID> floorIds = getFloorIdsByBlock(blockId);
    if (floorIds.isEmpty()) {
      return new ReconcileCommonAreasResult(0, 0, 0);
    }

    Map<Integer, UUID> entranceByNumber = getEntranceByNumber(blockId);
    Map<CellKey, Integer> desiredByCell = new HashMap<>();
    List<EntranceMatrixEntity> matrixRows = entityManager.createQuery(
            "select em from EntranceMatrixEntity em where em.block.id = :blockId", EntranceMatrixEntity.class)
        .setParameter("blockId", blockId)
        .getResultList();
    for (EntranceMatrixEntity row : matrixRows) {
      UUID entranceId = entranceByNumber.get(row.getEntranceNumber());
      if (entranceId == null || row.getFloor() == null || row.getFloor().getId() == null) {
        continue;
      }
      desiredByCell.put(
          new CellKey(row.getFloor().getId(), entranceId),
          Math.max(0, row.getMopCount() == null ? 0 : row.getMopCount())
      );
    }

    List<CommonAreaEntity> existing = entityManager.createQuery(
            "select ca from CommonAreaEntity ca where ca.floor.id in :floorIds", CommonAreaEntity.class)
        .setParameter("floorIds", floorIds)
        .getResultList();

    Map<CellKey, List<CommonAreaEntity>> existingByCell = new HashMap<>();
    for (CommonAreaEntity area : existing) {
      if (area.getFloor() == null || area.getFloor().getId() == null || area.getEntrance() == null || area.getEntrance().getId() == null) {
        continue;
      }
      CellKey key = new CellKey(area.getFloor().getId(), area.getEntrance().getId());
      existingByCell.computeIfAbsent(key, ignored -> new ArrayList<>()).add(area);
    }

    Set<CellKey> allKeys = new HashSet<>();
    allKeys.addAll(existingByCell.keySet());
    allKeys.addAll(desiredByCell.keySet());

    int removed = 0;
    int created = 0;
    int checkedCells = 0;
    int batchCounter = 0;

    for (CellKey key : allKeys) {
      checkedCells++;
      int desired = desiredByCell.getOrDefault(key, 0);
      List<CommonAreaEntity> list = existingByCell.getOrDefault(key, List.of()).stream()
          .sorted(Comparator.comparing(CommonAreaEntity::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())))
          .toList();

      if (list.size() > desired) {
        List<UUID> toDelete = list.subList(desired, list.size()).stream().map(CommonAreaEntity::getId).toList();
        entityManager.createQuery("delete from CommonAreaEntity ca where ca.id in :ids")
            .setParameter("ids", toDelete)
            .executeUpdate();
        removed += toDelete.size();
      } else if (list.size() < desired) {
        int missing = desired - list.size();
        for (int i = 0; i < missing; i++) {
          CommonAreaEntity entity = new CommonAreaEntity();
          entity.setId(UUID.randomUUID());
          entity.setFloor(entityManager.getReference(FloorEntity.class, key.floorId()));
          entity.setEntrance(entityManager.getReference(EntranceEntity.class, key.entranceId()));
          entity.setType("mop");
          entity.setArea(BigDecimal.ZERO);
          entityManager.persist(entity);
          created++;
          batchCounter++;
          flushAndClearEachBatch(batchCounter);
        }
      }
    }
    flushTail(batchCounter);

    triggerProjectTepRecalculationByBlock(blockId);
    return new ReconcileCommonAreasResult(removed, created, checkedCells);
  }

  @Transactional
  public JsonNode updateCommonArea(UUID id, UpsertCommonAreaRequest request) {
    if (request == null || request.floorId() == null || request.type() == null || request.type().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorId and type are required");
    }

    UUID targetId = id == null ? request.id() : id;
    if (targetId == null) {
      targetId = UUID.randomUUID();
    }

    CommonAreaEntity entity = entityManager.find(CommonAreaEntity.class, targetId);
    if (entity == null) {
      entity = new CommonAreaEntity();
      entity.setId(targetId);
    }

    entity.setFloor(entityManager.getReference(FloorEntity.class, request.floorId()));
    entity.setEntrance(request.entranceId() == null ? null : entityManager.getReference(EntranceEntity.class, request.entranceId()));
    entity.setType(request.type());
    entity.setArea(request.area());
    entity.setHeight(request.height());

    if (entityManager.contains(entity)) {
      entityManager.merge(entity);
    } else {
      entityManager.persist(entity);
    }

    triggerProjectTepRecalculationByBlock(getBlockIdByFloor(request.floorId()));
    return commonAreaToJson(entity);
  }

  @Transactional
  public int clearCommonAreas(UUID blockId, List<UUID> floorIds) {
    List<UUID> targetFloorIds = resolveBlockFloorIds(blockId, floorIds);
    if (targetFloorIds.isEmpty()) {
      return 0;
    }

    List<UUID> ids = entityManager.createQuery(
            "select ca.id from CommonAreaEntity ca where ca.floor.id in :floorIds", UUID.class)
        .setParameter("floorIds", targetFloorIds)
        .getResultList();
    if (ids.isEmpty()) {
      return 0;
    }

    entityManager.createQuery("delete from CommonAreaEntity ca where ca.id in :ids")
        .setParameter("ids", ids)
        .executeUpdate();
    int deleted = ids.size();
    triggerProjectTepRecalculationByBlock(blockId);
    return deleted;
  }

  @Transactional
  public void clearCommonAreasForIds(List<UUID> ids) {
    if (ids == null || ids.isEmpty()) {
      return;
    }
    UUID blockId = findAnyBlockIdByCommonAreaIds(ids);

    entityManager.createQuery("delete from CommonAreaEntity ca where ca.id in :ids")
        .setParameter("ids", ids)
        .executeUpdate();

    triggerProjectTepRecalculationByBlock(blockId);
  }

  @Transactional
  public ReconcileUnitsResult reconcileUnitsForBlock(UUID blockId, ReconcileUnitsForBlockRequest request) {
    List<UUID> floorIds = getFloorIdsByBlock(blockId);
    if (floorIds.isEmpty()) {
      return new ReconcileUnitsResult(0, 0, 0);
    }

    Map<Integer, UUID> entranceByNumber = getEntranceByNumber(blockId);
    Map<UUID, Integer> entranceNumberById = entranceByNumber.entrySet().stream()
        .collect(Collectors.toMap(Map.Entry::getValue, Map.Entry::getKey));
    Map<CellKey, CellDemand> demandMap = getDemandByCell(blockId, entranceByNumber);
    Map<CellKey, ExistingUnitsBucket> existingByCell = getExistingUnitsByCell(floorIds);
    Map<UUID, Integer> floorIndexById = getFloorIndexById(floorIds);

    int flatSequence = getMaxExistingUnitNumber(blockId, true);
    int commercialSequence = getMaxExistingUnitNumber(blockId, false);

    List<UUID> toDelete = new ArrayList<>();
    List<UnitPlan> toCreate = new ArrayList<>();
    int checkedCells = 0;

    Set<CellKey> allKeys = new HashSet<>();
    allKeys.addAll(existingByCell.keySet());
    allKeys.addAll(demandMap.keySet());

    List<CellKey> orderedKeys = new ArrayList<>(allKeys);
    orderedKeys.sort(Comparator
        .comparingInt((CellKey key) -> entranceNumberById.getOrDefault(key.entranceId(), Integer.MAX_VALUE))
        .thenComparingInt(key -> floorIndexById.getOrDefault(key.floorId(), Integer.MAX_VALUE)));

    for (CellKey key : orderedKeys) {
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
          toCreate.add(new UnitPlan(key.floorId(), key.entranceId(), "flat"));
        }
      }

      if (existing.commercial.size() > demand.commercial()) {
        existing.commercial.subList(demand.commercial(), existing.commercial.size()).forEach(unit -> toDelete.add(unit.id()));
      } else if (existing.commercial.size() < demand.commercial()) {
        int missing = demand.commercial() - existing.commercial.size();
        for (int i = 0; i < missing; i++) {
          toCreate.add(new UnitPlan(key.floorId(), key.entranceId(), "office"));
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
      if (isFlat(plan.unitType())) {
        flatSequence++;
        entity.setNumber("Кв." + flatSequence);
      } else {
        commercialSequence++;
        entity.setNumber("Оф." + commercialSequence);
      }
      entity.setUnitCode(ujIdentifierJpaService.generateUnitCode(blockId, plan.unitType()));
      entity.setHasMezzanine(false);
      entity.setRoomsCount(0);
      entity.setTotalArea(BigDecimal.ZERO);
      entity.setLivingArea(BigDecimal.ZERO);
      entity.setUsefulArea(BigDecimal.ZERO);
      entity.setStatus("free");
      entityManager.persist(entity);
      created++;
      batchCounter++;

      flushAndClearEachBatch(batchCounter);
    }
    flushTail(batchCounter);

    triggerProjectTepRecalculationByBlock(blockId);
    return new ReconcileUnitsResult(toDelete.size(), checkedCells, created);
  }

  @Transactional
  public ReconcileFloorsResult reconcileFloors(UUID blockId, ReconcileFloorsRequest request) {
    if (request == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "reconcile request is required");
    }

    List<GeneratedFloorModel> targetFloors = generateFloorsModel(blockId, request);
    targetFloors.sort(Comparator.comparing(GeneratedFloorModel::sortKey));

    List<FloorLite> existing = getFloorsLite(blockId);
    Map<String, FloorLite> existingByKey = existing.stream()
        .collect(Collectors.toMap(FloorLite::constraintKey, f -> f, (a, b) -> a, LinkedHashMap::new));

    Set<UUID> usedExistingIds = new HashSet<>();
    int upserted = 0;
    int batchCounter = 0;

    for (GeneratedFloorModel target : targetFloors) {
      FloorLite existingFloor = existingByKey.get(target.constraintKey());
      if (existingFloor == null) {
        FloorEntity entity = new FloorEntity();
        entity.setId(UUID.randomUUID());
        entity.setBlock(entityManager.getReference(uz.reestr.mkd.backendjpa.entity.BlockEntity.class, blockId));
        entity.setFloorIndex(target.floorIndex());
        entity.setFloorKey(target.floorKey());
        entity.setLabel(target.label());
        entity.setFloorType(target.floorType());
        entity.setAreaProj(BigDecimal.ZERO);
        entity.setAreaFact(BigDecimal.ZERO);
        entity.setParentFloorIndex(target.parentFloorIndex());
        entity.setBasementId(target.basementId());
        entity.setIsTechnical(target.isTechnical());
        entity.setIsCommercial(target.isCommercial());
        entity.setIsStylobate(target.isStylobate());
        entity.setIsBasement(target.isBasement());
        entity.setIsAttic(target.isAttic());
        entity.setIsLoft(target.isLoft());
        entity.setIsRoof(target.isRoof());
        entityManager.persist(entity);
      } else {
        entityManager.createQuery("""
            update FloorEntity f
               set f.floorIndex = :floorIndex,
                   f.floorKey = :floorKey,
                   f.label = :label,
                   f.floorType = :floorType,
                   f.parentFloorIndex = :parentFloorIndex,
                   f.basementId = :basementId,
                   f.isTechnical = :isTechnical,
                   f.isCommercial = :isCommercial,
                   f.isStylobate = :isStylobate,
                   f.isBasement = :isBasement,
                   f.isAttic = :isAttic,
                   f.isLoft = :isLoft,
                   f.isRoof = :isRoof
             where f.id = :id
            """)
            .setParameter("floorIndex", target.floorIndex())
            .setParameter("floorKey", target.floorKey())
            .setParameter("label", target.label())
            .setParameter("floorType", target.floorType())
            .setParameter("parentFloorIndex", target.parentFloorIndex())
            .setParameter("basementId", target.basementId())
            .setParameter("isTechnical", target.isTechnical())
            .setParameter("isCommercial", target.isCommercial())
            .setParameter("isStylobate", target.isStylobate())
            .setParameter("isBasement", target.isBasement())
            .setParameter("isAttic", target.isAttic())
            .setParameter("isLoft", target.isLoft())
            .setParameter("isRoof", target.isRoof())
            .setParameter("id", existingFloor.id())
            .executeUpdate();
        usedExistingIds.add(existingFloor.id());
      }

      upserted++;
      batchCounter++;
      flushAndClearEachBatch(batchCounter);
    }
    flushTail(batchCounter);

    List<UUID> toDelete = existing.stream()
        .map(FloorLite::id)
        .filter(id -> !usedExistingIds.contains(id))
        .toList();

    if (!toDelete.isEmpty()) {
      entityManager.createQuery("delete from FloorEntity f where f.id in :ids")
          .setParameter("ids", toDelete)
          .executeUpdate();
    }

    recalculateBlockAreaAndMatrix(blockId);
    triggerProjectTepRecalculationByBlock(blockId);
    return new ReconcileFloorsResult(toDelete.size(), upserted);
  }

  @Transactional
  public ReconcileEntrancesResult reconcileEntrances(UUID blockId, ReconcileEntrancesRequest request) {
    int normalizedCount = Math.max(0, request == null || request.count() == null ? 0 : request.count());

    List<Object[]> rows = entityManager.createQuery(
            "select e.id, e.number from EntranceEntity e where e.block.id = :blockId", Object[].class)
        .setParameter("blockId", blockId)
        .getResultList();

    Set<Integer> existingNumbers = new HashSet<>();
    List<UUID> toDelete = new ArrayList<>();
    for (Object[] row : rows) {
      UUID id = (UUID) row[0];
      Integer number = (Integer) row[1];
      if (number == null) {
        continue;
      }
      existingNumbers.add(number);
      if (number > normalizedCount) {
        toDelete.add(id);
      }
    }

    int created = 0;
    int batchCounter = 0;
    for (int i = 1; i <= normalizedCount; i++) {
      if (existingNumbers.contains(i)) {
        continue;
      }
      EntranceEntity entity = new EntranceEntity();
      entity.setId(UUID.randomUUID());
      entity.setBlock(entityManager.getReference(uz.reestr.mkd.backendjpa.entity.BlockEntity.class, blockId));
      entity.setNumber(i);
      entityManager.persist(entity);
      created++;
      batchCounter++;
      flushAndClearEachBatch(batchCounter);
    }
    flushTail(batchCounter);

    if (!toDelete.isEmpty()) {
      entityManager.createQuery("delete from EntranceEntity e where e.id in :ids")
          .setParameter("ids", toDelete)
          .executeUpdate();
    }

    recalculateBlockAreaAndMatrix(blockId);
    triggerProjectTepRecalculationByBlock(blockId);
    return new ReconcileEntrancesResult(normalizedCount, created, toDelete.size());
  }

  @Transactional
  public EntranceMatrixEntity upsertEntranceMatrixCell(UUID blockId, UpsertMatrixCellRequest request) {
    if (request == null || request.floorId() == null || request.entranceNumber() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorId and entranceNumber are required");
    }

    MatrixCellValues values = request.values();
    if (values == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "values must include at least one field: apts, units, mopQty");
    }

    Integer flats = nonNegativeBounded(values.apts(), "apts");
    Integer commercial = nonNegativeBounded(values.units(), "units");
    Integer mop = nonNegativeBounded(values.mopQty(), "mopQty");
    if (flats == null && commercial == null && mop == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "values must include at least one field: apts, units, mopQty");
    }

    EntranceMatrixEntity row = findMatrixRow(blockId, request.floorId(), request.entranceNumber());
    if (row == null) {
      row = new EntranceMatrixEntity();
      row.setId(UUID.randomUUID());
      row.setBlock(entityManager.getReference(uz.reestr.mkd.backendjpa.entity.BlockEntity.class, blockId));
      row.setFloor(entityManager.getReference(FloorEntity.class, request.floorId()));
      row.setEntranceNumber(request.entranceNumber());
      row.setFlatsCount(0);
      row.setCommercialCount(0);
      row.setMopCount(0);
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

    EntranceMatrixEntity merged = entityManager.merge(row);
    recalculateBlockAreaAndMatrix(blockId);
    triggerProjectTepRecalculationByBlock(blockId);
    return merged;
  }

  @Transactional
  public BatchUpsertMatrixCellsResponse batchUpsertEntranceMatrixCells(UUID blockId, BatchUpsertMatrixCellsRequest request) {
    if (request == null || request.cells() == null || request.cells().isEmpty()) {
      return new BatchUpsertMatrixCellsResponse(0, List.of());
    }

    List<String> failed = new ArrayList<>();
    int updated = 0;
    int batchCounter = 0;
    String jsonbColumn = resolveEntranceMatrixJsonbColumn();

    for (int i = 0; i < request.cells().size(); i++) {
      MatrixCellInput cell = request.cells().get(i);
      try {
        MatrixMutation mutation = validateMatrixInput(cell);
        upsertMatrixCellNative(blockId, mutation, jsonbColumn);
        updated++;
        batchCounter++;
        flushAndClearEachBatch(batchCounter);
      } catch (ResponseStatusException ex) {
        failed.add("index=" + i + ": " + ex.getReason());
      }
    }
    flushTail(batchCounter);

    recalculateBlockAreaAndMatrix(blockId);
    triggerProjectTepRecalculationByBlock(blockId);
    return new BatchUpsertMatrixCellsResponse(updated, failed);
  }

  @Transactional
  public void recalculateBlockAreaAndMatrix(UUID blockId) {
    BigDecimal sum = floorRepository.sumAreaProjByBlockId(blockId);

    entityManager.createNativeQuery("""
        update building_blocks
           set block_footprint_area_m2 = :area,
               updated_at = now()
         where id = :blockId
        """)
        .setParameter("area", sum == null ? BigDecimal.ZERO : sum)
        .setParameter("blockId", blockId)
        .executeUpdate();

    ensureEntranceMatrixForBlock(blockId);
    removeEmptyMatrixCells(blockId);
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

    int batchCounter = 0;
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
        batchCounter++;
        flushAndClearEachBatch(batchCounter);
      }
    }
    flushTail(batchCounter);
  }

  private MatrixMutation validateMatrixInput(MatrixCellInput cell) {
    if (cell == null || cell.floorId() == null || cell.entranceNumber() == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "floorId and entranceNumber are required");
    }

    MatrixCellValues values = cell.values();
    Integer flats = values == null ? null : nonNegativeBounded(values.apts(), "apts");
    Integer commercial = values == null ? null : nonNegativeBounded(values.units(), "units");
    Integer mop = values == null ? null : nonNegativeBounded(values.mopQty(), "mopQty");
    if (flats == null && commercial == null && mop == null) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "values must include at least one field: apts, units, mopQty");
    }

    return new MatrixMutation(cell.floorId(), cell.entranceNumber(), flats, commercial, mop);
  }

  private void upsertMatrixCellNative(UUID blockId, MatrixMutation mutation, String jsonbColumn) {
    String sql = """
        insert into entrance_matrix(id, block_id, floor_id, entrance_number, flats_count, commercial_count, mop_count, created_at, updated_at)
        values (:id, :blockId, :floorId, :entranceNumber, :flats, :commercial, :mop, now(), now())
        on conflict (block_id, floor_id, entrance_number)
        do update
           set flats_count = coalesce(excluded.flats_count, entrance_matrix.flats_count),
               commercial_count = coalesce(excluded.commercial_count, entrance_matrix.commercial_count),
               mop_count = coalesce(excluded.mop_count, entrance_matrix.mop_count),
               updated_at = now()
        """;

    if (jsonbColumn != null) {
      sql += ",\n               " + jsonbColumn + " = coalesce(entrance_matrix." + jsonbColumn + ", '{}'::jsonb) || cast(:matrixJson as jsonb)";
    }

    var query = entityManager.createNativeQuery(sql)
        .setParameter("id", UUID.randomUUID())
        .setParameter("blockId", blockId)
        .setParameter("floorId", mutation.floorId())
        .setParameter("entranceNumber", mutation.entranceNumber())
        .setParameter("flats", mutation.flats())
        .setParameter("commercial", mutation.commercial())
        .setParameter("mop", mutation.mop());

    if (jsonbColumn != null) {
      query.setParameter("matrixJson", toJsonbPayload(mutation));
    }

    query.executeUpdate();
  }

  private String resolveEntranceMatrixJsonbColumn() {
    List<String> candidates = List.of("values_jsonb", "values_json", "values", "matrix_values", "payload");
    List<String> found = entityManager.createNativeQuery("""
        select column_name
          from information_schema.columns
         where table_name = 'entrance_matrix'
           and udt_name = 'jsonb'
        """)
        .getResultList();

    for (String candidate : candidates) {
      if (found.contains(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  private String toJsonbPayload(MatrixMutation mutation) {
    Map<String, Integer> values = new LinkedHashMap<>();
    if (mutation.flats() != null) {
      values.put("apts", mutation.flats());
    }
    if (mutation.commercial() != null) {
      values.put("units", mutation.commercial());
    }
    if (mutation.mop() != null) {
      values.put("mopQty", mutation.mop());
    }

    StringBuilder builder = new StringBuilder("{");
    boolean first = true;
    for (Map.Entry<String, Integer> entry : values.entrySet()) {
      if (!first) {
        builder.append(',');
      }
      builder.append('"').append(entry.getKey()).append('"').append(':').append(entry.getValue());
      first = false;
    }
    builder.append('}');
    return builder.toString();
  }

  private Integer nonNegativeBounded(Integer value, String field) {
    if (value == null) {
      return null;
    }
    if (value < 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be non-negative");
    }
    if (value > MAX_MATRIX_VALUE) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be <= " + MAX_MATRIX_VALUE);
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

  private FloorShape buildFloorShape(Integer floorIndex, String defaultType, ReconcileFloorsOptions options) {
    String floorType = defaultType == null || defaultType.isBlank() ? "residential" : defaultType;
    boolean isTechnical = false;
    boolean isCommercial = false;

    if (options != null) {
      if (Boolean.TRUE.equals(options.includeTechnical()) && floorIndex % 5 == 0) {
        isTechnical = true;
      }
      if (Boolean.TRUE.equals(options.includeCommercial()) && floorIndex == 1) {
        isCommercial = true;
      }
      if (options.rules() != null) {
        for (FloorTemplateRule rule : options.rules()) {
          if (rule == null || rule.from() == null || rule.to() == null) {
            continue;
          }
          if (floorIndex >= rule.from() && floorIndex <= rule.to()) {
            if (rule.floorType() != null && !rule.floorType().isBlank()) {
              floorType = rule.floorType();
            }
            if (rule.flags() != null) {
              if (rule.flags().isTechnical() != null) {
                isTechnical = rule.flags().isTechnical();
              }
              if (rule.flags().isCommercial() != null) {
                isCommercial = rule.flags().isCommercial();
              }
            }
          }
        }
      }
    }

    return new FloorShape(floorType, isTechnical, isCommercial);
  }

  private List<GeneratedFloorModel> generateFloorsModel(UUID blockId, ReconcileFloorsRequest request) {
    BlockSeed block = fetchBlockSeed(blockId);
    BuildingSeed building = fetchBuildingSeed(block.buildingId());
    List<BlockSeed> allBlocks = fetchBlocksByBuilding(block.buildingId());
    List<MarkerSeed> markers = fetchMarkers(blockId);

    List<GeneratedFloorModel> targetFloors = new ArrayList<>();
    int sortOrder = 0;

    boolean isParking = "parking_separate".equals(building.category()) || "Parking".equals(block.type());
    boolean isInfrastructure = "infrastructure".equals(building.category()) || "Infra".equals(block.type());
    boolean isUndergroundParking = isParking
        && ("underground".equals(building.parkingType())
        || "underground".equals(building.constructionType())
        || (block.levelsDepth() != null && block.levelsDepth() > 0));

    if (isUndergroundParking) {
      int depth = block.levelsDepth() == null ? 1 : Math.max(1, block.levelsDepth());
      for (int i = 1; i <= depth; i++) {
        targetFloors.add(new GeneratedFloorModel(
            -i,
            "parking:-" + i,
            "Уровень -" + i,
            "parking_floor",
            null,
            null,
            false,
            false,
            false,
            false,
            false,
            false,
            false,
            sortOrder++
        ));
      }
      return deduplicateFloors(targetFloors);
    }

    List<BlockSeed> blockBasements = allBlocks.stream()
        .filter(BlockSeed::isBasementBlock)
        .filter(b -> jsonArrayContains(b.linkedBlockIdsRaw(), blockId))
        .toList();
    boolean hasMultipleBasements = blockBasements.size() > 1;

    for (int bIdx = 0; bIdx < blockBasements.size(); bIdx++) {
      BlockSeed basementBlock = blockBasements.get(bIdx);
      int depth = basementBlock.basementDepth() == null ? 1 : Math.max(1, basementBlock.basementDepth());
      for (int d = depth; d >= 1; d--) {
        boolean markerCommercial = findMarker(markers, "basement_" + basementBlock.id()).isCommercial()
            || findMarker(markers, "basement").isCommercial();
        boolean mapCommercial = basementBlock.basementParkingLevels().containsKey(String.valueOf(d));
        boolean isMixed = markerCommercial || mapCommercial;

        String label = "Подвал (этаж -" + d + ")";
        if (hasMultipleBasements) {
          label = "Подвал " + (bIdx + 1) + " (этаж -" + d + ")";
        }

        targetFloors.add(new GeneratedFloorModel(
            -d,
            "basement:" + basementBlock.id() + ":" + d,
            label,
            "basement",
            null,
            basementBlock.id(),
            false,
            isMixed,
            false,
            true,
            false,
            false,
            false,
            sortOrder++
        ));
      }
    }

    if (block.hasBasement()) {
      targetFloors.add(new GeneratedFloorModel(
          0,
          "tsokol",
          "Цокольный этаж",
          "tsokol",
          null,
          null,
          false,
          findMarker(markers, "tsokol").isCommercial(),
          false,
          false,
          false,
          false,
          false,
          sortOrder++
      ));
    }

    Map<Integer, String> stylobateMap = new HashMap<>();
    if ("Ж".equals(block.type())) {
      for (BlockSeed b : allBlocks) {
        if (b.isBasementBlock()) {
          continue;
        }
        if ("Н".equals(b.type()) && jsonArrayContains(b.parentBlocksRaw(), block.id())) {
          int h = b.floorsTo() == null ? 0 : b.floorsTo();
          for (int k = 1; k <= h; k++) {
            stylobateMap.put(k, b.label());
          }
        }
      }
    }

    int start = 1;
    int end = 1;
    if (isParking || isInfrastructure) {
      end = block.floorsCount() == null ? 1 : Math.max(1, block.floorsCount());
    } else {
      start = block.floorsFrom() == null ? 1 : block.floorsFrom();
      end = block.floorsTo() == null ? 1 : block.floorsTo();
    }

    for (int i = start; i <= end; i++) {
      MarkerSeed marker = findMarker(markers, String.valueOf(i));
      boolean isMixed = marker.isCommercial();

      if (stylobateMap.containsKey(i)) {
        targetFloors.add(new GeneratedFloorModel(
            i,
            "floor:" + i,
            i + " этаж",
            "stylobate",
            null,
            null,
            false,
            true,
            true,
            false,
            false,
            false,
            false,
            sortOrder++
        ));
      } else {
        String type = "residential";
        if ("Н".equals(block.type())) {
          type = "office";
        }
        if (isParking) {
          type = "parking_floor";
        }
        if (isInfrastructure) {
          type = "office";
        }
        if ("Ж".equals(block.type()) && isMixed) {
          type = "mixed";
        }

        targetFloors.add(new GeneratedFloorModel(
            i,
            "floor:" + i,
            i + " этаж",
            type,
            null,
            null,
            false,
            isMixed || "office".equals(type),
            false,
            false,
            false,
            false,
            false,
            sortOrder++
        ));
      }

      MarkerSeed techMarker = findMarker(markers, i + "-Т");
      if (techMarker.isTechnical()) {
        targetFloors.add(new GeneratedFloorModel(
            i,
            "tech:" + i,
            i + "-Т (Технический)",
            "technical",
            i,
            null,
            true,
            techMarker.isCommercial(),
            false,
            false,
            false,
            false,
            false,
            sortOrder++
        ));
      }
    }

    for (MarkerSeed marker : markers) {
      if ("technical".equals(marker.markerType()) && marker.floorIndex() != null && marker.floorIndex() > end) {
        int fIdx = marker.floorIndex();
        targetFloors.add(new GeneratedFloorModel(
            fIdx,
            "tech:" + fIdx,
            fIdx + " (Тех)",
            "technical",
            fIdx,
            null,
            true,
            false,
            false,
            false,
            false,
            false,
            false,
            sortOrder++
        ));
      }
    }

    if (block.hasAttic()) {
      targetFloors.add(new GeneratedFloorModel(
          end + 1,
          "attic",
          "Мансарда",
          "attic",
          null,
          null,
          false,
          findMarker(markers, "attic").isCommercial(),
          false,
          false,
          true,
          false,
          false,
          sortOrder++
      ));
    }

    if (block.hasLoft()) {
      targetFloors.add(new GeneratedFloorModel(
          end + 2,
          "loft",
          "Чердак",
          "loft",
          null,
          null,
          false,
          findMarker(markers, "loft").isCommercial(),
          false,
          false,
          false,
          true,
          false,
          sortOrder++
      ));
    }

    if (block.hasRoofExpl()) {
      targetFloors.add(new GeneratedFloorModel(
          end + 3,
          "roof",
          "Эксплуатируемая кровля",
          "roof",
          null,
          null,
          false,
          findMarker(markers, "roof").isCommercial(),
          false,
          false,
          false,
          false,
          true,
          sortOrder++
      ));
    }

    return deduplicateFloors(targetFloors);
  }

  private List<GeneratedFloorModel> deduplicateFloors(List<GeneratedFloorModel> floors) {
    Map<String, GeneratedFloorModel> unique = new LinkedHashMap<>();
    for (GeneratedFloorModel floor : floors) {
      unique.putIfAbsent(floor.constraintKey(), floor);
    }
    return unique.values().stream()
        .sorted(Comparator.comparing(GeneratedFloorModel::sortKey)
            .thenComparing(GeneratedFloorModel::floorIndex)
            .thenComparing(GeneratedFloorModel::floorKey))
        .toList();
  }

  private BlockSeed fetchBlockSeed(UUID blockId) {
    Object[] row = (Object[]) entityManager.createNativeQuery("""
        select b.id, b.building_id, b.label, b.type, b.floors_count, b.floors_from, b.floors_to,
               b.levels_depth, coalesce(b.has_basement, false), coalesce(b.has_attic, false),
               coalesce(b.has_loft, false), coalesce(b.has_roof_expl, false),
               coalesce(b.is_basement_block, false), b.basement_depth,
               cast(coalesce(b.basement_parking_levels, '{}'::jsonb) as text),
               cast(coalesce(b.linked_block_ids, '[]'::jsonb) as text),
               cast(coalesce(b.parent_blocks, '[]'::jsonb) as text)
          from building_blocks b
         where b.id = :id
        """)
        .setParameter("id", blockId)
        .getResultList()
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Block not found"));

    return new BlockSeed(
        (UUID) row[0],
        (UUID) row[1],
        stringValue(row[2]),
        stringValue(row[3]),
        intValue(row[4]),
        intValue(row[5]),
        intValue(row[6]),
        intValue(row[7]),
        boolValue(row[8]),
        boolValue(row[9]),
        boolValue(row[10]),
        boolValue(row[11]),
        boolValue(row[12]),
        intValue(row[13]),
        mapFromJsonText(stringValue(row[14])),
        stringValue(row[15]),
        stringValue(row[16])
    );
  }

  private BuildingSeed fetchBuildingSeed(UUID buildingId) {
    Object[] row = (Object[]) entityManager.createNativeQuery("""
        select b.id, b.category, b.parking_type, b.construction_type
          from buildings b
         where b.id = :id
        """)
        .setParameter("id", buildingId)
        .getResultList()
        .stream()
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Building not found"));

    return new BuildingSeed((UUID) row[0], stringValue(row[1]), stringValue(row[2]), stringValue(row[3]));
  }

  private List<BlockSeed> fetchBlocksByBuilding(UUID buildingId) {
    List<Object[]> rows = entityManager.createNativeQuery("""
        select b.id, b.building_id, b.label, b.type, b.floors_count, b.floors_from, b.floors_to,
               b.levels_depth, coalesce(b.has_basement, false), coalesce(b.has_attic, false),
               coalesce(b.has_loft, false), coalesce(b.has_roof_expl, false),
               coalesce(b.is_basement_block, false), b.basement_depth,
               cast(coalesce(b.basement_parking_levels, '{}'::jsonb) as text),
               cast(coalesce(b.linked_block_ids, '[]'::jsonb) as text),
               cast(coalesce(b.parent_blocks, '[]'::jsonb) as text)
          from building_blocks b
         where b.building_id = :buildingId
        """)
        .setParameter("buildingId", buildingId)
        .getResultList();

    List<BlockSeed> out = new ArrayList<>();
    for (Object[] row : rows) {
      out.add(new BlockSeed(
          (UUID) row[0],
          (UUID) row[1],
          stringValue(row[2]),
          stringValue(row[3]),
          intValue(row[4]),
          intValue(row[5]),
          intValue(row[6]),
          intValue(row[7]),
          boolValue(row[8]),
          boolValue(row[9]),
          boolValue(row[10]),
          boolValue(row[11]),
          boolValue(row[12]),
          intValue(row[13]),
          mapFromJsonText(stringValue(row[14])),
          stringValue(row[15]),
          stringValue(row[16])
      ));
    }
    return out;
  }

  private List<MarkerSeed> fetchMarkers(UUID blockId) {
    List<Object[]> rows = entityManager.createNativeQuery("""
        select marker_key, marker_type, floor_index, coalesce(is_technical, false), coalesce(is_commercial, false)
          from block_floor_markers
         where block_id = :blockId
        """)
        .setParameter("blockId", blockId)
        .getResultList();

    List<MarkerSeed> out = new ArrayList<>();
    for (Object[] row : rows) {
      out.add(new MarkerSeed(
          stringValue(row[0]),
          stringValue(row[1]),
          intValue(row[2]),
          boolValue(row[3]),
          boolValue(row[4])
      ));
    }
    return out;
  }

  private MarkerSeed findMarker(List<MarkerSeed> markers, String key) {
    for (MarkerSeed marker : markers) {
      if (key.equals(marker.markerKey())) {
        return marker;
      }
    }
    return MarkerSeed.EMPTY;
  }

  private boolean jsonArrayContains(String rawJsonArray, UUID expectedId) {
    if (rawJsonArray == null || expectedId == null) {
      return false;
    }
    return rawJsonArray.contains(expectedId.toString());
  }

  private Map<String, Object> mapFromJsonText(String json) {
    Map<String, Object> out = new LinkedHashMap<>();
    if (json == null || json.isBlank() || "{}".equals(json)) {
      return out;
    }
    String normalized = json.trim();
    if (normalized.startsWith("{") && normalized.endsWith("}")) {
      normalized = normalized.substring(1, normalized.length() - 1);
      if (normalized.isBlank()) {
        return out;
      }
      String[] chunks = normalized.split(",");
      for (String chunk : chunks) {
        String[] kv = chunk.split(":", 2);
        if (kv.length == 2) {
          String key = kv[0].replace(""", "").trim();
          String valueRaw = kv[1].replace(""", "").trim();
          if (!key.isBlank()) {
            out.put(key, valueRaw);
          }
        }
      }
    }
    return out;
  }

  private String stringValue(Object value) {
    return value == null ? null : String.valueOf(value);
  }

  private Integer intValue(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof Number n) {
      return n.intValue();
    }
    try {
      return Integer.parseInt(String.valueOf(value));
    } catch (NumberFormatException ex) {
      return null;
    }
  }

  private boolean boolValue(Object value) {
    if (value instanceof Boolean b) {
      return b;
    }
    if (value == null) {
      return false;
    }
    return "true".equalsIgnoreCase(String.valueOf(value)) || "1".equals(String.valueOf(value));
  }

  private void removeEmptyMatrixCells(UUID blockId) {
    entityManager.createNativeQuery("""
        delete from entrance_matrix em
         where em.block_id = :blockId
           and coalesce(em.flats_count, 0) = 0
           and coalesce(em.commercial_count, 0) = 0
           and coalesce(em.mop_count, 0) = 0
        """)
        .setParameter("blockId", blockId)
        .executeUpdate();
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

  private BigDecimal toBigDecimal(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof BigDecimal bd) {
      return bd;
    }
    if (value instanceof Number number) {
      return BigDecimal.valueOf(number.doubleValue());
    }
    return new BigDecimal(value.toString());
  }

  private void recalculateUnitAreas(UUID unitId) {
    UnitEntity unit = entityManager.find(UnitEntity.class, unitId);
    if (unit == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Unit not found");
    }

    List<RoomEntity> rooms = entityManager.createQuery(
            "select r from RoomEntity r where r.unit.id = :unitId", RoomEntity.class)
        .setParameter("unitId", unitId)
        .getResultList();

    Set<String> roomTypes = rooms.stream()
        .map(RoomEntity::getRoomType)
        .filter(Objects::nonNull)
        .collect(Collectors.toSet());

    Map<String, RoomTypeMeta> roomMeta = new HashMap<>();
    if (!roomTypes.isEmpty()) {
      @SuppressWarnings("unchecked")
      List<Object[]> rows = entityManager.createNativeQuery(
              "select code, coalesce(coefficient, 1), coalesce(area_bucket, 'useful') "
                  + "from dict_room_types where code in (:codes)")
          .setParameter("codes", roomTypes)
          .getResultList();

      for (Object[] row : rows) {
        String code = (String) row[0];
        BigDecimal coefficient = toBigDecimal(row[1]);
        String areaBucket = (String) row[2];
        roomMeta.put(code, new RoomTypeMeta(coefficient == null ? BigDecimal.ONE : coefficient, areaBucket));
      }
    }

    BigDecimal total = BigDecimal.ZERO;
    BigDecimal living = BigDecimal.ZERO;
    BigDecimal useful = BigDecimal.ZERO;

    for (RoomEntity room : rooms) {
      BigDecimal area = room.getArea() == null ? BigDecimal.ZERO : room.getArea();
      RoomTypeMeta meta = roomMeta.getOrDefault(room.getRoomType(), new RoomTypeMeta(BigDecimal.ONE, "useful"));

      total = total.add(area.multiply(meta.coefficient()));
      if ("living".equalsIgnoreCase(meta.areaBucket())) {
        living = living.add(area);
      } else if ("useful".equalsIgnoreCase(meta.areaBucket())) {
        useful = useful.add(area);
      }
    }

    unit.setTotalArea(total);
    unit.setLivingArea(living);
    unit.setUsefulArea(useful);

    triggerProjectTepRecalculationByBlock(getBlockIdByFloor(unit.getFloor().getId()));
  }

  private JsonNode roomToJson(RoomEntity room) {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", room.getId() == null ? null : room.getId().toString());
    node.put("unit_id", room.getUnit() == null || room.getUnit().getId() == null ? null : room.getUnit().getId().toString());
    node.put("room_type", room.getRoomType());
    node.put("name", room.getName());
    node.put("area", room.getArea() == null ? null : room.getArea().doubleValue());
    node.put("room_height", room.getRoomHeight() == null ? null : room.getRoomHeight().doubleValue());
    node.put("level", room.getLevel());
    node.put("is_mezzanine", Boolean.TRUE.equals(room.getIsMezzanine()));
    return node;
  }

  private record RoomTypeMeta(BigDecimal coefficient, String areaBucket) {
  }

  private void triggerProjectTepRecalculationByBlock(UUID blockId) {
    if (blockId == null) {
      return;
    }
    UUID projectId = getProjectIdByBlock(blockId);
    calculationsJpaService.recalculateProjectAfterCommit(projectId);
  }

  private UUID getProjectIdByBlock(UUID blockId) {
    return entityManager.createQuery(
            "select b.building.projectId from BlockEntity b where b.id = :blockId", UUID.class)
        .setParameter("blockId", blockId)
        .getResultStream()
        .findFirst()
        .orElse(null);
  }

  private UUID getBlockIdByFloor(UUID floorId) {
    if (floorId == null) {
      return null;
    }
    return entityManager.createQuery(
            "select f.block.id from FloorEntity f where f.id = :floorId", UUID.class)
        .setParameter("floorId", floorId)
        .getResultStream()
        .findFirst()
        .orElse(null);
  }

  private UUID findAnyBlockIdByCommonAreaIds(List<UUID> ids) {
    if (ids == null || ids.isEmpty()) {
      return null;
    }
    return entityManager.createQuery(
            "select ca.floor.block.id from CommonAreaEntity ca where ca.id in :ids", UUID.class)
        .setParameter("ids", ids)
        .setMaxResults(1)
        .getResultStream()
        .findFirst()
        .orElse(null);
  }

  private List<UUID> resolveBlockFloorIds(UUID blockId, List<UUID> floorIds) {
    Set<UUID> ids = new HashSet<>(getFloorIdsByBlock(blockId));
    if (floorIds != null) {
      ids.addAll(floorIds);
    }
    return new ArrayList<>(ids);
  }

  private JsonNode commonAreaToJson(CommonAreaEntity entity) {
    ObjectNode node = objectMapper.createObjectNode();
    node.put("id", entity.getId() == null ? null : entity.getId().toString());
    node.put("floorId", entity.getFloor() == null || entity.getFloor().getId() == null ? null : entity.getFloor().getId().toString());
    node.put("entranceId",
        entity.getEntrance() == null || entity.getEntrance().getId() == null ? null : entity.getEntrance().getId().toString());
    node.put("type", entity.getType());
    if (entity.getArea() == null) {
      node.putNull("area");
    } else {
      node.put("area", entity.getArea());
    }
    if (entity.getHeight() == null) {
      node.putNull("height");
    } else {
      node.put("height", entity.getHeight());
    }
    return node;
  }

  private Map<UUID, Integer> getFloorIndexById(List<UUID> floorIds) {
    if (floorIds == null || floorIds.isEmpty()) {
      return Map.of();
    }
    List<Object[]> rows = entityManager.createQuery(
            "select f.id, f.floorIndex from FloorEntity f where f.id in :floorIds", Object[].class)
        .setParameter("floorIds", floorIds)
        .getResultList();
    Map<UUID, Integer> out = new HashMap<>();
    for (Object[] row : rows) {
      out.put((UUID) row[0], (Integer) row[1]);
    }
    return out;
  }

  private int getMaxExistingUnitNumber(UUID blockId, boolean flats) {
    String sql = flats
        ? """
        select coalesce(max(cast(nullif(regexp_replace(coalesce(u.number, ''), '\\D', '', 'g'), '') as integer)), 0)
          from units u
          join floors f on f.id = u.floor_id
         where f.block_id = :blockId
           and u.unit_type in ('flat', 'duplex_up', 'duplex_down')
        """
        : """
        select coalesce(max(cast(nullif(regexp_replace(coalesce(u.number, ''), '\\D', '', 'g'), '') as integer)), 0)
          from units u
          join floors f on f.id = u.floor_id
         where f.block_id = :blockId
           and u.unit_type in ('office', 'office_inventory', 'non_res_block', 'infrastructure')
        """;
    Number max = (Number) entityManager.createNativeQuery(sql)
        .setParameter("blockId", blockId)
        .getSingleResult();
    return max == null ? 0 : max.intValue();
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
            "select f.id, f.floorIndex, f.parentFloorIndex, f.basementId from FloorEntity f where f.block.id = :blockId", Object[].class)
        .setParameter("blockId", blockId)
        .getResultList();
    List<FloorLite> out = new ArrayList<>();
    for (Object[] row : rows) {
      out.add(new FloorLite((UUID) row[0], (Integer) row[1], (Integer) row[2], (UUID) row[3]));
    }
    return out;
  }

  private void flushAndClearEachBatch(int batchCounter) {
    if (batchCounter > 0 && batchCounter % BATCH_SIZE == 0) {
      entityManager.flush();
      entityManager.clear();
    }
  }

  private void flushTail(int batchCounter) {
    if (batchCounter > 0 && batchCounter % BATCH_SIZE != 0) {
      entityManager.flush();
      entityManager.clear();
    }
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

  private record UnitPlan(UUID floorId, UUID entranceId, String unitType) {
  }

  private record FloorLite(UUID id, Integer index, Integer parentFloorIndex, UUID basementId) {

    String constraintKey() {
      int pfi = parentFloorIndex == null ? -99999 : parentFloorIndex;
      UUID bid = basementId == null ? UUID.fromString("00000000-0000-0000-0000-000000000000") : basementId;
      return index + "_" + pfi + "_" + bid;
    }
  }

  private record FloorShape(String floorType, boolean isTechnical, boolean isCommercial) {
  }

  private record GeneratedFloorModel(
      Integer floorIndex,
      String floorKey,
      String label,
      String floorType,
      Integer parentFloorIndex,
      UUID basementId,
      Boolean isTechnical,
      Boolean isCommercial,
      Boolean isStylobate,
      Boolean isBasement,
      Boolean isAttic,
      Boolean isLoft,
      Boolean isRoof,
      Integer sortKey
  ) {

    String constraintKey() {
      int pfi = parentFloorIndex == null ? -99999 : parentFloorIndex;
      UUID bid = basementId == null ? UUID.fromString("00000000-0000-0000-0000-000000000000") : basementId;
      return floorIndex + "_" + pfi + "_" + bid;
    }
  }

  private record MatrixMutation(UUID floorId, Integer entranceNumber, Integer flats, Integer commercial, Integer mop) {
  }

  private record BlockSeed(
      UUID id,
      UUID buildingId,
      String label,
      String type,
      Integer floorsCount,
      Integer floorsFrom,
      Integer floorsTo,
      Integer levelsDepth,
      boolean hasBasement,
      boolean hasAttic,
      boolean hasLoft,
      boolean hasRoofExpl,
      boolean isBasementBlock,
      Integer basementDepth,
      Map<String, Object> basementParkingLevels,
      String linkedBlockIdsRaw,
      String parentBlocksRaw
  ) {
  }

  private record BuildingSeed(UUID id, String category, String parkingType, String constructionType) {
  }

  private record MarkerSeed(String markerKey, String markerType, Integer floorIndex, boolean isTechnical, boolean isCommercial) {

    private static final MarkerSeed EMPTY = new MarkerSeed("", "", null, false, false);
  }

  private static final class ExistingUnitsBucket {

    private final List<UnitLite> flats = new ArrayList<>();
    private final List<UnitLite> commercial = new ArrayList<>();
  }

  private JsonNode extensionToJson(BlockExtensionEntity e) {
    ObjectNode n = objectMapper.createObjectNode();
    n.put("id", e.getId() == null ? null : e.getId().toString());
    n.put("parentBlockId", e.getParentBlock() == null ? null : e.getParentBlock().getId().toString());
    n.put("label", e.getLabel());
    n.put("extensionType", e.getExtensionType());
    n.put("constructionKind", e.getConstructionKind());
    n.put("floorsCount", e.getFloorsCount());
    return n;
  }

  private JsonNode floorToJson(FloorEntity floor) {
    ObjectNode n = objectMapper.createObjectNode();
    n.put("id", floor.getId() == null ? null : floor.getId().toString());
    n.put("blockId", floor.getBlock() == null ? null : floor.getBlock().getId().toString());
    n.put("floorKey", floor.getFloorKey());
    n.put("index", floor.getFloorIndex());
    n.put("label", floor.getLabel());
    n.put("type", floor.getFloorType());
    n.put("height", floor.getHeight() == null ? null : floor.getHeight().doubleValue());
    n.put("areaProj", floor.getAreaProj() == null ? null : floor.getAreaProj().doubleValue());
    n.put("areaFact", floor.getAreaFact() == null ? null : floor.getAreaFact().doubleValue());
    return n;
  }

  private JsonNode entranceToJson(EntranceEntity entrance) {
    ObjectNode n = objectMapper.createObjectNode();
    n.put("id", entrance.getId() == null ? null : entrance.getId().toString());
    n.put("blockId", entrance.getBlock() == null ? null : entrance.getBlock().getId().toString());
    n.put("number", entrance.getNumber());
    return n;
  }

  private JsonNode matrixToJson(EntranceMatrixEntity m) {
    ObjectNode n = objectMapper.createObjectNode();
    n.put("id", m.getId() == null ? null : m.getId().toString());
    n.put("floorId", m.getFloor() == null ? null : m.getFloor().getId().toString());
    n.put("entranceNumber", m.getEntranceNumber());
    n.put("flatsCount", m.getFlatsCount());
    n.put("commercialCount", m.getCommercialCount());
    n.put("mopCount", m.getMopCount());
    return n;
  }

  private JsonNode unitToJson(UnitEntity unit) {
    ObjectNode n = objectMapper.createObjectNode();
    n.put("id", unit.getId() == null ? null : unit.getId().toString());
    n.put("floorId", unit.getFloor() == null ? null : unit.getFloor().getId().toString());
    n.put("entranceId", unit.getEntrance() == null ? null : unit.getEntrance().getId().toString());
    n.put("num", unit.getNumber());
    n.put("type", unit.getUnitType());
    n.put("area", unit.getTotalArea() == null ? null : unit.getTotalArea().doubleValue());
    n.put("rooms", unit.getRoomsCount());
    return n;
  }

  public record ReconcileUnitsResult(int removed, int checkedCells, int created) {
  }

  public record ReconcileFloorsResult(int deleted, int upserted) {
  }

  public record ReconcileEntrancesResult(int count, int created, int deleted) {
  }

  public record ReconcileCommonAreasResult(int removed, int created, int checkedCells) {
  }
}
