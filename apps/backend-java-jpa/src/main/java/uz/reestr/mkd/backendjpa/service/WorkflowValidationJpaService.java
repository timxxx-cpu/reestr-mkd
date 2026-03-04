package uz.reestr.mkd.backendjpa.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import uz.reestr.mkd.backendjpa.api.error.StepValidationException;
import uz.reestr.mkd.backendjpa.entity.ApplicationEntity;
import uz.reestr.mkd.backendjpa.entity.BlockEntity;
import uz.reestr.mkd.backendjpa.entity.BuildingEntity;
import uz.reestr.mkd.backendjpa.entity.CommonAreaEntity;
import uz.reestr.mkd.backendjpa.entity.EntranceMatrixEntity;
import uz.reestr.mkd.backendjpa.entity.FloorEntity;
import uz.reestr.mkd.backendjpa.entity.UnitEntity;
import uz.reestr.mkd.backendjpa.repository.BlockRepository;
import uz.reestr.mkd.backendjpa.repository.BuildingRepository;
import uz.reestr.mkd.backendjpa.repository.CommonAreaRepository;
import uz.reestr.mkd.backendjpa.repository.EntranceMatrixRepository;
import uz.reestr.mkd.backendjpa.repository.FloorRepository;
import uz.reestr.mkd.backendjpa.repository.UnitRepository;

@Service
public class WorkflowValidationJpaService {

  private static final int FLOORS_STEP_INDEX = 5;
  private static final int ENTRANCES_STEP_INDEX = 6;
  private static final int APARTMENTS_STEP_INDEX = 7;
  private static final int MOP_STEP_INDEX = 8;

  private final BuildingRepository buildingRepository;
  private final BlockRepository blockRepository;
  private final FloorRepository floorRepository;
  private final UnitRepository unitRepository;
  private final EntranceMatrixRepository entranceMatrixRepository;
  private final CommonAreaRepository commonAreaRepository;

  public WorkflowValidationJpaService(
      BuildingRepository buildingRepository,
      BlockRepository blockRepository,
      FloorRepository floorRepository,
      UnitRepository unitRepository,
      EntranceMatrixRepository entranceMatrixRepository,
      CommonAreaRepository commonAreaRepository
  ) {
    this.buildingRepository = buildingRepository;
    this.blockRepository = blockRepository;
    this.floorRepository = floorRepository;
    this.unitRepository = unitRepository;
    this.entranceMatrixRepository = entranceMatrixRepository;
    this.commonAreaRepository = commonAreaRepository;
  }

  public void validateStepBeforeCompletion(ApplicationEntity app, int stepIndex) {
    List<String> errors = new ArrayList<>();
    ValidationContext context = loadContext(app.getProjectId());

    switch (stepIndex) {
      case FLOORS_STEP_INDEX -> validateFloors(context, errors);
      case ENTRANCES_STEP_INDEX -> validateEntrances(context, errors);
      case APARTMENTS_STEP_INDEX -> validateApartments(context, errors);
      case MOP_STEP_INDEX -> validateMop(context, errors);
      default -> {
        return;
      }
    }

    if (!errors.isEmpty()) {
      throw new StepValidationException(HttpStatus.BAD_REQUEST, errors);
    }
  }

  private void validateFloors(ValidationContext context, List<String> errors) {
    for (BuildingEntity building : context.buildings()) {
      boolean skipBuilding = "parking_separate".equals(building.getCategory())
          && !"capital".equals(building.getConstructionType())
          && !"underground".equals(building.getParkingType());
      if (skipBuilding) {
        continue;
      }

      for (BlockEntity block : context.blocksByBuilding().getOrDefault(building.getId(), List.of())) {
        if (Boolean.TRUE.equals(block.getIsBasementBlock())) {
          continue;
        }

        List<FloorEntity> floors = context.floorsByBlock().getOrDefault(block.getId(), List.of());
        if (floors.isEmpty()) {
          errors.add("Объект: %s (%s): Нет данных об этажах. Заполните матрицу высот и площадей."
              .formatted(building.getLabel(), block.getLabel()));
          continue;
        }

        for (FloorEntity floor : floors) {
          String floorLabel = floorLabel(floor);
          boolean isRoof = Boolean.TRUE.equals(floor.getIsRoof())
              || "roof".equals(floor.getFloorType())
              || safe(floor.getFloorKey()).contains("roof");

          if (!isRoof) {
            if (floor.getHeight() == null) {
              errors.add("%s (%s), %s: Не указана высота.".formatted(building.getLabel(), block.getLabel(), floorLabel));
            } else {
              BigDecimal h = floor.getHeight();
              if (h.compareTo(BigDecimal.valueOf(1.8)) < 0 || h.compareTo(BigDecimal.valueOf(6.0)) > 0) {
                errors.add("%s (%s), %s: Недопустимая высота (%s)."
                    .formatted(building.getLabel(), block.getLabel(), floorLabel, h));
              }
            }
          }

          if (floor.getAreaProj() == null || floor.getAreaProj().compareTo(BigDecimal.ZERO) <= 0) {
            errors.add("%s (%s), %s: Не указана проектная площадь (S Проект)."
                .formatted(building.getLabel(), block.getLabel(), floorLabel));
          }

          if (floor.getAreaProj() != null && floor.getAreaProj().compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal fact = floor.getAreaFact() == null ? BigDecimal.ZERO : floor.getAreaFact();
            BigDecimal diffPct = floor.getAreaProj().subtract(fact).abs()
                .multiply(BigDecimal.valueOf(100))
                .divide(floor.getAreaProj(), 2, java.math.RoundingMode.HALF_UP);
            if (diffPct.compareTo(BigDecimal.valueOf(15)) > 0) {
              errors.add("%s (%s), %s: Критическое расхождение S Проект/Факт (>15%%)."
                  .formatted(building.getLabel(), block.getLabel(), floorLabel));
            }
          }
        }
      }
    }
  }

  private void validateEntrances(ValidationContext context, List<String> errors) {
    for (BuildingEntity building : context.buildings()) {
      if (!safe(building.getCategory()).contains("residential")) {
        continue;
      }

      for (BlockEntity block : context.blocksByBuilding().getOrDefault(building.getId(), List.of())) {
        if (!isResidentialBlock(block)) {
          continue;
        }

        int entrancesCount = block.getEntrancesCount() == null || block.getEntrancesCount() < 1 ? 1 : block.getEntrancesCount();
        List<FloorEntity> floors = context.floorsByBlock().getOrDefault(block.getId(), List.of());

        for (FloorEntity floor : floors) {
          if (isIgnoredFloorType(floor)) {
            continue;
          }

          boolean isMixed = "mixed".equals(safe(floor.getFloorType())) || Boolean.TRUE.equals(floor.getIsCommercial());
          String floorLabel = floorLabel(floor);

          for (int entranceNumber = 1; entranceNumber <= entrancesCount; entranceNumber++) {
            MatrixDemand matrix = context.matrixByKey().get(new MatrixKey(block.getId(), floor.getId(), entranceNumber));
            int aptCount = matrix == null ? 0 : matrix.apts();
            int unitCount = matrix == null ? 0 : matrix.units();
            int mopCount = matrix == null ? 0 : matrix.mop();

            if (isMixed) {
              if (aptCount == 0 && unitCount == 0) {
                errors.add("%s (%s), %s: Отмечен смешанный этаж, но не указаны помещения."
                    .formatted(building.getLabel(), block.getLabel(), floorLabel));
              }
              continue;
            }

            if (aptCount == 0 && mopCount == 0 && !isDuplexExtension(floors, floor)) {
              errors.add("%s (%s), %s (Подъезд %d): Не указано количество квартир."
                  .formatted(building.getLabel(), block.getLabel(), floorLabel, entranceNumber));
            }
          }
        }
      }
    }
  }

  private void validateApartments(ValidationContext context, List<String> errors) {
    Map<String, UUID> seen = new HashMap<>();
    Set<String> duplicateKeys = new HashSet<>();

    for (UnitEntity unit : context.units()) {
      if (unit.getBlock() == null || !isApartmentType(unit.getUnitType())) {
        continue;
      }
      String num = safe(unit.getNumber()).trim();
      if (num.isEmpty()) {
        continue;
      }
      String key = unit.getBlock().getId() + "::" + num;
      if (seen.putIfAbsent(key, unit.getId()) != null && duplicateKeys.add(key)) {
        String tail = unit.getBlock().getId().toString();
        errors.add("Дубликаты номеров: в блоке (ID: ...%s) повторяется номер \"%s\"."
            .formatted(tail.substring(Math.max(0, tail.length() - 4)), num));
      }
    }

    for (BuildingEntity building : context.buildings()) {
      if (!safe(building.getCategory()).contains("residential")) {
        continue;
      }

      for (BlockEntity block : context.blocksByBuilding().getOrDefault(building.getId(), List.of())) {
        if (!isResidentialBlock(block)) {
          continue;
        }

        List<FloorEntity> floors = context.floorsByBlock().getOrDefault(block.getId(), List.of());
        Map<UUID, List<UnitEntity>> unitsByFloor = context.unitsByFloor().entrySet().stream()
            .filter(e -> floors.stream().map(FloorEntity::getId).collect(Collectors.toSet()).contains(e.getKey()))
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        for (FloorEntity floor : floors) {
          MatrixDemand total = context.totalMatrixByFloor().get(floor.getId());
          int plannedApts = total == null ? 0 : total.apts();

          if (Boolean.TRUE.equals(floor.getIsDuplex()) && plannedApts > 0) {
            boolean hasDuplex = unitsByFloor.getOrDefault(floor.getId(), List.of()).stream()
                .anyMatch(u -> "duplex_up".equals(u.getUnitType()) || "duplex_down".equals(u.getUnitType()));
            if (!hasDuplex) {
              errors.add("Ошибка дуплекса: блок \"%s\", этаж %s отмечен как дуплексный, но двухуровневые квартиры не выбраны."
                  .formatted(block.getLabel(), floorLabel(floor)));
            }
          }

          if (plannedApts <= 0) {
            continue;
          }

          long numbered = unitsByFloor.getOrDefault(floor.getId(), List.of()).stream()
              .filter(u -> isApartmentType(u.getUnitType()))
              .map(u -> safe(u.getNumber()).trim())
              .filter(v -> !v.isEmpty())
              .count();

          if (numbered < plannedApts) {
            errors.add("Незаполненные номера: блок \"%s\", этаж %s: пронумеровано %d из %d квартир."
                .formatted(block.getLabel(), floorLabel(floor), numbered, plannedApts));
          }
        }
      }
    }
  }

  private void validateMop(ValidationContext context, List<String> errors) {
    Set<String> unique = new HashSet<>();

    for (BuildingEntity building : context.buildings()) {
      boolean isUnderground = "underground".equals(building.getParkingType());
      boolean isResidential = safe(building.getCategory()).contains("residential");
      if (!isResidential && !isUnderground) {
        continue;
      }

      for (BlockEntity block : context.blocksByBuilding().getOrDefault(building.getId(), List.of())) {
        if (!isUnderground && !isResidentialBlock(block)) {
          continue;
        }

        int entrancesCount = block.getEntrancesCount() == null || block.getEntrancesCount() < 1 ? 1 : block.getEntrancesCount();
        List<FloorEntity> floors = context.floorsByBlock().getOrDefault(block.getId(), List.of());

        for (FloorEntity floor : floors) {
          if (Boolean.TRUE.equals(floor.getIsRoof()) || safe(floor.getFloorKey()).contains("roof")) {
            continue;
          }

          String floorLabel = floorLabel(floor);
          for (int entranceNumber = 1; entranceNumber <= entrancesCount; entranceNumber++) {
            MatrixDemand matrix = context.matrixByKey().get(new MatrixKey(block.getId(), floor.getId(), entranceNumber));
            int targetQty = matrix == null ? 0 : matrix.mop();
            if (targetQty <= 0) {
              continue;
            }

            List<CommonAreaEntity> mops = context.mopsByFloorEntrance()
                .getOrDefault(new FloorEntranceKey(floor.getId(), entranceNumber), List.of());

            if (mops.size() < targetQty) {
              String message = "%s (%s), %s (Подъезд %d): Заявлено %d МОП, а заполнено %d."
                  .formatted(building.getLabel(), block.getLabel(), floorLabel, entranceNumber, targetQty, mops.size());
              if (unique.add(message)) {
                errors.add(message);
              }
            }

            for (int i = 0; i < Math.min(targetQty, mops.size()); i++) {
              CommonAreaEntity mop = mops.get(i);
              if (safe(mop.getType()).isBlank() || mop.getArea() == null || mop.getArea().compareTo(BigDecimal.ZERO) <= 0) {
                String message = "%s (%s), %s (Подъезд %d): У помещения №%d не заполнен тип или площадь."
                    .formatted(building.getLabel(), block.getLabel(), floorLabel, entranceNumber, i + 1);
                if (unique.add(message)) {
                  errors.add(message);
                }
              }
            }
          }
        }
      }
    }
  }

  private ValidationContext loadContext(UUID projectId) {
    List<BuildingEntity> buildings = buildingRepository.findByProjectId(projectId);
    List<BlockEntity> blocks = blockRepository.findByBuildingProjectId(projectId);
    List<FloorEntity> floors = floorRepository.findByBlockBuildingProjectId(projectId);
    List<UnitEntity> units = unitRepository.findByBlockBuildingProjectId(projectId);
    List<EntranceMatrixEntity> matrixRows = entranceMatrixRepository.findByBlockBuildingProjectId(projectId);
    List<CommonAreaEntity> mops = commonAreaRepository.findByFloorBlockBuildingProjectId(projectId);

    Map<UUID, List<BlockEntity>> blocksByBuilding = blocks.stream()
        .filter(b -> b.getBuilding() != null && b.getBuilding().getId() != null)
        .collect(Collectors.groupingBy(b -> b.getBuilding().getId()));

    Map<UUID, List<FloorEntity>> floorsByBlock = floors.stream()
        .filter(f -> f.getBlock() != null && f.getBlock().getId() != null)
        .sorted(Comparator.comparing((FloorEntity f) -> f.getFloorIndex() == null ? Integer.MIN_VALUE : f.getFloorIndex())
            .thenComparing(f -> safe(f.getFloorKey())))
        .collect(Collectors.groupingBy(f -> f.getBlock().getId()));

    Map<UUID, List<UnitEntity>> unitsByFloor = units.stream()
        .filter(u -> u.getFloor() != null && u.getFloor().getId() != null)
        .collect(Collectors.groupingBy(u -> u.getFloor().getId()));

    Map<MatrixKey, MatrixDemand> matrixByKey = new HashMap<>();
    Map<UUID, MatrixDemand> totalByFloor = new HashMap<>();
    for (EntranceMatrixEntity row : matrixRows) {
      if (row.getBlock() == null || row.getFloor() == null || row.getEntranceNumber() == null) {
        continue;
      }
      MatrixDemand demand = new MatrixDemand(
          safeInt(row.getFlatsCount()),
          safeInt(row.getCommercialCount()),
          safeInt(row.getMopCount())
      );
      matrixByKey.put(new MatrixKey(row.getBlock().getId(), row.getFloor().getId(), row.getEntranceNumber()), demand);
      totalByFloor.merge(row.getFloor().getId(), demand, MatrixDemand::plus);
    }

    Map<FloorEntranceKey, List<CommonAreaEntity>> mopsByFloorEntrance = mops.stream()
        .filter(m -> m.getFloor() != null && m.getFloor().getId() != null)
        .filter(m -> m.getEntrance() != null && m.getEntrance().getNumber() != null)
        .collect(Collectors.groupingBy(m -> new FloorEntranceKey(m.getFloor().getId(), m.getEntrance().getNumber())));

    return new ValidationContext(
        buildings,
        blocksByBuilding,
        floorsByBlock,
        units,
        unitsByFloor,
        matrixByKey,
        totalByFloor,
        mopsByFloorEntrance
    );
  }

  private boolean isApartmentType(String type) {
    return "flat".equals(type) || "duplex_up".equals(type) || "duplex_down".equals(type);
  }

  private boolean isIgnoredFloorType(FloorEntity floor) {
    String type = safe(floor.getFloorType());
    return "technical".equals(type)
        || "parking_floor".equals(type)
        || "office".equals(type)
        || "basement".equals(type)
        || "tsokol".equals(type)
        || "roof".equals(type)
        || "loft".equals(type)
        || Boolean.TRUE.equals(floor.getIsRoof());
  }

  private boolean isDuplexExtension(List<FloorEntity> floors, FloorEntity floor) {
    if (floor.getFloorIndex() == null || floor.getFloorIndex() <= 1) {
      return false;
    }
    int prev = floor.getFloorIndex() - 1;
    return floors.stream()
        .filter(f -> Objects.equals(f.getFloorIndex(), prev))
        .anyMatch(f -> Boolean.TRUE.equals(f.getIsDuplex()));
  }

  private boolean isResidentialBlock(BlockEntity block) {
    String type = safe(block.getType());
    return "ж".equals(type) || "residential".equals(type);
  }

  private String floorLabel(FloorEntity floor) {
    if (!safe(floor.getLabel()).isBlank()) {
      return floor.getLabel();
    }
    if (!safe(floor.getFloorKey()).isBlank()) {
      return floor.getFloorKey();
    }
    return "этаж " + (floor.getFloorIndex() == null ? "?" : floor.getFloorIndex());
  }

  private String safe(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private int safeInt(Integer value) {
    return value == null ? 0 : Math.max(0, value);
  }

  private record ValidationContext(
      List<BuildingEntity> buildings,
      Map<UUID, List<BlockEntity>> blocksByBuilding,
      Map<UUID, List<FloorEntity>> floorsByBlock,
      List<UnitEntity> units,
      Map<UUID, List<UnitEntity>> unitsByFloor,
      Map<MatrixKey, MatrixDemand> matrixByKey,
      Map<UUID, MatrixDemand> totalMatrixByFloor,
      Map<FloorEntranceKey, List<CommonAreaEntity>> mopsByFloorEntrance
  ) {
  }

  private record MatrixKey(UUID blockId, UUID floorId, Integer entranceNumber) {
  }

  private record FloorEntranceKey(UUID floorId, Integer entranceNumber) {
  }

  private record MatrixDemand(int apts, int units, int mop) {
    private MatrixDemand plus(MatrixDemand other) {
      return new MatrixDemand(apts + other.apts, units + other.units, mop + other.mop);
    }
  }
}
