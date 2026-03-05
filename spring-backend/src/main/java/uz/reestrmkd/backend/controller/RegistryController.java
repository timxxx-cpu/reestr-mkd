package uz.reestrmkd.backend.controller;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import uz.reestrmkd.backend.dto.ItemsResponseDto;
import uz.reestrmkd.backend.dto.MapPayloadDto;
import uz.reestrmkd.backend.dto.MapResponseDto;
import uz.reestrmkd.backend.entity.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.entity.BuildingBlockEntity;
import uz.reestrmkd.backend.entity.BuildingEntity;
import uz.reestrmkd.backend.entity.BlockExtensionEntity;
import uz.reestrmkd.backend.enums.UnitType;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.repository.BlockExtensionJpaRepository;
import uz.reestrmkd.backend.repository.BuildingBlockJpaRepository;
import uz.reestrmkd.backend.repository.BuildingJpaRepository;
import uz.reestrmkd.backend.security.ActorPrincipal;
import uz.reestrmkd.backend.service.FloorGeneratorService;
import uz.reestrmkd.backend.service.SecurityPolicyService;
import uz.reestrmkd.backend.service.UnitService;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1")
public class RegistryController {
    private final JdbcTemplate jdbcTemplate;
    private final BlockExtensionJpaRepository extensionRepo;
    private final BuildingBlockJpaRepository blockRepo;
    private final BuildingJpaRepository buildingRepo;
    private final BlockFloorMarkerJpaRepository markerRepo;
    private final FloorGeneratorService floorGeneratorService;
    private final SecurityPolicyService securityPolicyService;
    private final UnitService unitService;

    public RegistryController(
        JdbcTemplate jdbcTemplate,
        BlockExtensionJpaRepository extensionRepo,
        BuildingBlockJpaRepository blockRepo,
        BuildingJpaRepository buildingRepo,
        BlockFloorMarkerJpaRepository markerRepo,
        FloorGeneratorService floorGeneratorService,
        SecurityPolicyService securityPolicyService,
        UnitService unitService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.extensionRepo = extensionRepo;
        this.blockRepo = blockRepo;
        this.buildingRepo = buildingRepo;
        this.markerRepo = markerRepo;
        this.floorGeneratorService = floorGeneratorService;
        this.securityPolicyService = securityPolicyService;
        this.unitService = unitService;
    }

    @GetMapping("/registry/buildings-summary")
    public ItemsResponseDto buildingsSummary(
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String building,
        @RequestParam(required = false) String floor,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer limit
    ) {
        StringBuilder sql = new StringBuilder("select * from view_registry_buildings_summary where 1=1");
        List<Object> args = new ArrayList<>();
        if (search != null && !search.isBlank()) {
            sql.append(" and (coalesce(project_name,'') ilike ? or coalesce(building_name,'') ilike ? or coalesce(block_label,'') ilike ?)");
            String like = "%" + search + "%";
            args.add(like); args.add(like); args.add(like);
        }
        sql.append(" order by project_name asc");
        return new ItemsResponseDto(jdbcTemplate.queryForList(sql.toString(), args.toArray()));
    }

    @GetMapping("/projects/{projectId}/parking-counts")
    public MapResponseDto parkingCounts(@PathVariable UUID projectId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
            select f.id as floor_id, count(u.id) as count
            from floors f
            left join units u on u.floor_id=f.id and u.unit_type='parking_place'
            join building_blocks bb on bb.id=f.block_id
            join buildings b on b.id=bb.building_id
            where b.project_id=?
            group by f.id
        """, projectId);
        Map<String, Integer> result = new HashMap<>();
        for (Map<String, Object> row : rows) {
            result.put(String.valueOf(row.get("floor_id")), ((Number) row.get("count")).intValue());
        }
        return MapResponseDto.of(Map.copyOf(result));
    }

    @PostMapping("/floors/{floorId}/parking-places/sync")
    public MapResponseDto syncParking(@PathVariable UUID floorId, @RequestBody(required = false) MapPayloadDto payload) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        int targetCount = Math.max(0, toInt(body.get("targetCount"), 0));

        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "select id, number from units where floor_id=? and unit_type='parking_place'",
            floorId
        );
        int current = existing.size();
        int removed = 0;
        int added = 0;

        if (current == targetCount) {
            return MapResponseDto.of(Map.of("ok", true, "added", 0, "removed", 0));
        }

        if (current < targetCount) {
            for (int i = 0; i < (targetCount - current); i++) {
                added += jdbcTemplate.update(
                    "insert into units(id,floor_id,number,unit_type,total_area,status,created_at,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,?)",
                    floorId,
                    null,
                    "parking_place",
                    null,
                    "free",
                    Instant.now(),
                    Instant.now()
                );
            }
        } else {
            List<Map<String, Object>> sorted = new ArrayList<>(existing);
            sorted.sort((left, right) -> Integer.compare(toInt(right.get("number"), 0), toInt(left.get("number"), 0)));
            List<Map<String, Object>> toDelete = sorted.subList(0, current - targetCount);
            for (Map<String, Object> row : toDelete) {
                removed += jdbcTemplate.update("delete from units where id = ?", UUID.fromString(String.valueOf(row.get("id"))));
            }
        }

        return MapResponseDto.of(Map.of("ok", true, "added", added, "removed", removed));
    }

    @GetMapping("/blocks/{blockId}/floors")
    public ItemsResponseDto getFloors(@PathVariable UUID blockId) {
        return new ItemsResponseDto(jdbcTemplate.queryForList("select * from floors where block_id=? order by index", blockId));
    }

    @GetMapping("/blocks/{blockId}/entrances")
    public ItemsResponseDto getEntrances(@PathVariable UUID blockId) {
        return new ItemsResponseDto(jdbcTemplate.queryForList("select * from entrances where block_id=? order by number", blockId));
    }

    @GetMapping("/blocks/{blockId}/extensions")
    public List<BlockExtensionEntity> getExtensions(@PathVariable UUID blockId) {
        return extensionRepo.findByParentBlockIdIn(List.of(blockId));
    }

    @PostMapping("/blocks/{blockId}/extensions")
    public BlockExtensionEntity createExtension(@PathVariable UUID blockId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        BlockExtensionEntity e = new BlockExtensionEntity();
        e.setId(UUID.randomUUID());
        e.setParentBlockId(blockId);
        e.setBuildingId(UUID.fromString(String.valueOf(body.get("buildingId"))));
        e.setLabel(String.valueOf(body.getOrDefault("label", "Пристройка")));
        e.setExtensionType((String) body.get("extensionType"));
        e.setConstructionKind((String) body.get("constructionKind"));
        e.setFloorsCount(body.get("floorsCount") == null ? 1 : Integer.parseInt(String.valueOf(body.get("floorsCount"))));
        e.setStartFloorIndex(body.get("startFloorIndex") == null ? 1 : Integer.parseInt(String.valueOf(body.get("startFloorIndex"))));
        e.setVerticalAnchorType((String) body.get("verticalAnchorType"));
        e.setAnchorFloorKey((String) body.get("anchorFloorKey"));
        e.setNotes((String) body.get("notes"));
        e.setCreatedAt(Instant.now());
        e.setUpdatedAt(Instant.now());
        return extensionRepo.save(e);
    }

    @PutMapping("/extensions/{extensionId}")
    public MapResponseDto updateExt(@PathVariable UUID extensionId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        BlockExtensionEntity e = extensionRepo.findById(extensionId).orElseThrow(() -> new ApiException("Extension not found", "NOT_FOUND", null, 404));
        if (body.containsKey("label")) e.setLabel(String.valueOf(body.get("label")));
        if (body.containsKey("floorsCount")) e.setFloorsCount(Integer.parseInt(String.valueOf(body.get("floorsCount"))));
        if (body.containsKey("startFloorIndex")) e.setStartFloorIndex(Integer.parseInt(String.valueOf(body.get("startFloorIndex"))));
        e.setUpdatedAt(Instant.now());
        extensionRepo.save(e);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @DeleteMapping("/extensions/{extensionId}")
    public MapResponseDto delExt(@PathVariable UUID extensionId) {
        extensionRepo.deleteById(extensionId);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @GetMapping("/units/{unitId}/explication")
    public ResponseEntity<?> explication(@PathVariable UUID unitId) {
        List<Map<String, Object>> unitRows = jdbcTemplate.queryForList("select * from units where id=?", unitId);
        if (unitRows.isEmpty()) {
            return ResponseEntity.ok().body(null);
        }

        Map<String, Object> unit = new HashMap<>(unitRows.getFirst());
        List<Map<String, Object>> rawRooms = jdbcTemplate.queryForList(
            "select * from rooms where unit_id=? order by created_at asc, id asc",
            unitId
        );
        List<Map<String, Object>> rooms = rawRooms.stream().map(room -> {
            Map<String, Object> mapped = new HashMap<>(room);
            mapped.put("type", room.get("room_type"));
            mapped.put("label", room.get("name"));
            mapped.put("height", room.get("room_height"));
            mapped.put("isMezzanine", Boolean.TRUE.equals(room.get("is_mezzanine")));
            return mapped;
        }).toList();

        unit.put("rooms", rooms);
        return ResponseEntity.ok(MapResponseDto.of(unit));
    }

 @GetMapping("/blocks/{blockId}/units")
    public MapResponseDto units(
        @PathVariable UUID blockId,
        @RequestParam(required = false) String floorIds,
        @RequestParam(required = false) String search,
        @RequestParam(required = false) String type,
        @RequestParam(required = false) String building,
        @RequestParam(required = false) String floor,
        @RequestParam(required = false) Integer page,
        @RequestParam(required = false) Integer limit
    ) {
        int normalizedPage = Math.max(1, page == null ? 1 : page);
        int normalizedLimit = Math.min(1000, Math.max(1, limit == null ? 1000 : limit));
        int offset = (normalizedPage - 1) * normalizedLimit;
        List<String> floorsArr = floorIds == null || floorIds.isBlank() ? List.of() : Arrays.stream(floorIds.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();

        // ИСПРАВЛЕНИЕ: Используем (block_id = ? OR floor_id IN (...)), чтобы захватить и основной блок, и связанные этажи
        StringBuilder sql = new StringBuilder("""
            select u.*
            from units u
            join floors f on f.id=u.floor_id
            join building_blocks bb on bb.id=f.block_id
            join buildings b on b.id=bb.building_id
            where (f.block_id=?
        """);
        List<Object> args = new ArrayList<>();
        args.add(blockId);
        
        if (!floorsArr.isEmpty()) {
            sql.append(" or u.floor_id in (").append(String.join(",", Collections.nCopies(floorsArr.size(), "?"))).append(")");
            args.addAll(floorsArr);
        }
        sql.append(")"); // Закрываем скобку условия OR

        // Дополнительные фильтры (поиск, тип и т.д.)
        if (search != null && !search.isBlank()) {
            sql.append(" and (coalesce(u.number,'') ilike ? or coalesce(u.unit_code,'') ilike ?)");
            String like = "%" + search + "%";
            args.add(like); args.add(like);
        }
        if (type != null && !type.isBlank()) { sql.append(" and u.unit_type=?"); args.add(type); }
        if (building != null && !building.isBlank()) {
            sql.append(" and (coalesce(b.label,'') ilike ? or coalesce(b.house_number,'') ilike ?)");
            String like = "%" + building + "%";
            args.add(like);
            args.add(like);
        }
        if (floor != null && !floor.isBlank()) {
            sql.append(" and (coalesce(f.label,'') ilike ? or cast(f.index as text) ilike ?)");
            String like = "%" + floor + "%";
            args.add(like);
            args.add(like);
        }
        sql.append(" order by u.number asc nulls last, u.created_at asc limit ? offset ?");
        args.add(normalizedLimit);
        args.add(offset);
        List<Map<String, Object>> units = jdbcTemplate.queryForList(sql.toString(), args.toArray());

        // ИСПРАВЛЕНИЕ: Загружаем подъезды всех блоков, чьи квартиры могут вернуться (основной + стилобаты)
        StringBuilder entSql = new StringBuilder("select id, number from entrances where block_id=?");
        List<Object> entArgs = new ArrayList<>();
        entArgs.add(blockId);
        if (!floorsArr.isEmpty()) {
            entSql.append(" or block_id in (select block_id from floors where id in (")
                  .append(String.join(",", Collections.nCopies(floorsArr.size(), "?")))
                  .append("))");
            entArgs.addAll(floorsArr);
        }
        
        List<Map<String, Object>> entrances = jdbcTemplate.queryForList(entSql.toString(), entArgs.toArray());
        Map<String, Integer> entranceMap = entrances.stream().collect(Collectors.toMap(
            r -> String.valueOf(r.get("id")), 
            r -> ((Number) r.get("number")).intValue(),
            (v1, v2) -> v1 // Игнорируем дубликаты, если они есть
        ));

        return MapResponseDto.of(Map.of("units", units, "entranceMap", entranceMap));
    }

    @PostMapping("/units/upsert")
    public MapResponseDto upsertUnit(@RequestBody(required = false) MapPayloadDto payload) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> data = payload == null || payload.data() == null ? Map.of() : payload.data();
        UUID unitId = unitService.upsertUnit(data);
        return MapResponseDto.of(Map.of("ok", true, "id", unitId));
    }

    @PostMapping("/blocks/{blockId}/units/reconcile")
    public MapResponseDto reconcileUnits(@PathVariable UUID blockId) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> result = new HashMap<>();
        result.put("removed", 0);
        result.put("added", 0); // Добавлено поле для метрики созданных
        result.put("checkedCells", 0);

        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<UUID> floorIds = floors.stream().map(row -> UUID.fromString(String.valueOf(row.get("id")))).toList();
        if (floorIds.isEmpty()) return MapResponseDto.of(result);

        Map<Integer, UUID> entranceByNumber = loadEntranceMap(blockId);
        Map<String, Map<String, Integer>> desiredMap = new HashMap<>();

        List<Map<String, Object>> matrixRows = jdbcTemplate.queryForList(
            "select floor_id, entrance_number, flats_count, commercial_count from entrance_matrix where block_id=?",
            blockId
        );
        for (Map<String, Object> row : matrixRows) {
            Integer entranceNumber = toNullableInt(row.get("entrance_number"));
            UUID entranceId = entranceByNumber.get(entranceNumber);
            if (entranceId == null) continue;
            String key = row.get("floor_id") + "_" + entranceId;
            desiredMap.put(key, Map.of(
                "flats", Math.max(0, toInt(row.get("flats_count"), 0)),
                "commercial", Math.max(0, toInt(row.get("commercial_count"), 0))
            ));
        }

        String inFloors = String.join(",", Collections.nCopies(floorIds.size(), "?"));
        List<Map<String, Object>> units = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_id, unit_type, cadastre_number, total_area, useful_area, living_area, created_at from units where floor_id in (" + inFloors + ")",
            floorIds.toArray()
        );

        Map<String, List<Map<String, Object>>> flatsGrouped = new HashMap<>();
        Map<String, List<Map<String, Object>>> commGrouped = new HashMap<>();
        for (Map<String, Object> unit : units) {
            String type = String.valueOf(unit.get("unit_type"));
            String key = unit.get("floor_id") + "_" + unit.get("entrance_id");
            if (isFlatType(type)) flatsGrouped.computeIfAbsent(key, k -> new ArrayList<>()).add(unit);
            else if (isCommercialType(type)) commGrouped.computeIfAbsent(key, k -> new ArrayList<>()).add(unit);
        }

        // ИСПРАВЛЕНИЕ 1: Итерируемся и по тем ячейкам, которые есть в матрице, но пока пусты в БД
        Set<String> keys = new HashSet<>(desiredMap.keySet());
        keys.addAll(flatsGrouped.keySet());
        keys.addAll(commGrouped.keySet());

        List<UUID> toDelete = new ArrayList<>();
        int added = 0;

        for (String key : keys) {
            result.put("checkedCells", ((Integer) result.get("checkedCells")) + 1);
            Map<String, Integer> desired = desiredMap.getOrDefault(key, Map.of("flats", 0, "commercial", 0));
            List<Map<String, Object>> flats = new ArrayList<>(flatsGrouped.getOrDefault(key, List.of()));
            List<Map<String, Object>> comm = new ArrayList<>(commGrouped.getOrDefault(key, List.of()));
            
            Comparator<Map<String, Object>> preserveRichDataComparator = Comparator
                .comparing((Map<String, Object> row) -> hasCadastreNumber(row) ? 0 : 1)
                .thenComparing(row -> hasAreaData(row) ? 0 : 1)
                .thenComparing(row -> toInstant(row.get("created_at")));
            flats.sort(preserveRichDataComparator);
            comm.sort(preserveRichDataComparator);

            String[] parts = key.split("_");
            UUID floorId = UUID.fromString(parts[0]);
            UUID entranceId = UUID.fromString(parts[1]);

            // Жилые квартиры
            int desiredFlats = desired.get("flats");
            if (flats.size() > desiredFlats) {
                flats.subList(desiredFlats, flats.size())
                    .forEach(row -> toDelete.add(UUID.fromString(String.valueOf(row.get("id")))));
            } else if (flats.size() < desiredFlats) {
                // ИСПРАВЛЕНИЕ 2: Создаем недостающие квартиры 
                int toAdd = desiredFlats - flats.size();
                for(int i = 0; i < toAdd; i++) {
                    jdbcTemplate.update(
                        "insert into units(id,floor_id,entrance_id,unit_type,status,created_at,updated_at) values (gen_random_uuid(),?,?,?,?,now(),now())",
                        floorId, entranceId, "flat", "free"
                    );
                    added++;
                }
            }

            // Коммерческие помещения
            int desiredComm = desired.get("commercial");
            if (comm.size() > desiredComm) {
                comm.subList(desiredComm, comm.size())
                    .forEach(row -> toDelete.add(UUID.fromString(String.valueOf(row.get("id")))));
            } else if (comm.size() < desiredComm) {
                // ИСПРАВЛЕНИЕ 3: Создаем недостающую коммерцию
                int toAdd = desiredComm - comm.size();
                for(int i = 0; i < toAdd; i++) {
                    jdbcTemplate.update(
                        "insert into units(id,floor_id,entrance_id,unit_type,status,created_at,updated_at) values (gen_random_uuid(),?,?,?,?,now(),now())",
                        floorId, entranceId, "office", "free"
                    );
                    added++;
                }
            }
        }

        if (!toDelete.isEmpty()) {
            String inIds = String.join(",", Collections.nCopies(toDelete.size(), "?"));
            int removed = jdbcTemplate.update("delete from units where id in (" + inIds + ")", toDelete.toArray());
            result.put("removed", removed);
        }
        result.put("added", added);
        
        return MapResponseDto.of(result);
    }

    @PostMapping("/blocks/{blockId}/common-areas/reconcile")
    public MapResponseDto reconcileMops(@PathVariable UUID blockId) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> result = new HashMap<>();
        result.put("removed", 0);
        result.put("checkedCells", 0);

        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<UUID> floorIds = floors.stream().map(row -> UUID.fromString(String.valueOf(row.get("id")))).toList();
        if (floorIds.isEmpty()) return MapResponseDto.of(result);

        Map<Integer, UUID> entranceByNumber = loadEntranceMap(blockId);
        Map<String, Integer> desiredMap = new HashMap<>();
        List<Map<String, Object>> matrixRows = jdbcTemplate.queryForList(
            "select floor_id, entrance_number, mop_count from entrance_matrix where block_id=?",
            blockId
        );
        for (Map<String, Object> row : matrixRows) {
            Integer entranceNumber = toNullableInt(row.get("entrance_number"));
            UUID entranceId = entranceByNumber.get(entranceNumber);
            if (entranceId == null) continue;
            desiredMap.put(row.get("floor_id") + "_" + entranceId, Math.max(0, toInt(row.get("mop_count"), 0)));
        }

        String inFloors = String.join(",", Collections.nCopies(floorIds.size(), "?"));
        List<Map<String, Object>> areas = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_id, created_at from common_areas where floor_id in (" + inFloors + ")",
            floorIds.toArray()
        );

        Map<String, List<Map<String, Object>>> grouped = new HashMap<>();
        for (Map<String, Object> area : areas) {
            String key = area.get("floor_id") + "_" + area.get("entrance_id");
            grouped.computeIfAbsent(key, k -> new ArrayList<>()).add(area);
        }

        List<UUID> toDelete = new ArrayList<>();
        for (Map.Entry<String, List<Map<String, Object>>> entry : grouped.entrySet()) {
            result.put("checkedCells", ((Integer) result.get("checkedCells")) + 1);
            int desired = desiredMap.getOrDefault(entry.getKey(), 0);
            List<Map<String, Object>> sorted = new ArrayList<>(entry.getValue());
            sorted.sort(Comparator.comparing(r -> toInstant(r.get("created_at"))));
            if (sorted.size() > desired) {
                sorted.subList(desired, sorted.size())
                    .forEach(row -> toDelete.add(UUID.fromString(String.valueOf(row.get("id")))));
            }
        }

        if (!toDelete.isEmpty()) {
            String inIds = String.join(",", Collections.nCopies(toDelete.size(), "?"));
            int removed = jdbcTemplate.update("delete from common_areas where id in (" + inIds + ")", toDelete.toArray());
            result.put("removed", removed);
        }
        return MapResponseDto.of(result);
    }

    @PostMapping("/units/batch-upsert")
    public MapResponseDto batchUpsertUnits(@RequestBody(required = false) MapPayloadDto payload) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("unitsList", body.getOrDefault("items", List.of()));
        int count = unitService.batchUpsertUnits(items);
        return MapResponseDto.of(Map.of("ok", true, "count", count));
    }

    @PostMapping("/common-areas/upsert")
    public MapResponseDto upsertCommon(@RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> data = payload == null || payload.data() == null ? Map.of() : payload.data();
        saveMopRow(data);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @PostMapping("/common-areas/batch-upsert")
    public MapResponseDto batchUpsertMops(@RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items", body.getOrDefault("mops", List.of()));
        for (Map<String, Object> item : items) {
            saveMopRow(item);
        }
        return MapResponseDto.of(Map.of("ok", true, "count", items.size()));
    }

    @DeleteMapping("/common-areas/{id}")
    public MapResponseDto deleteCommon(@PathVariable UUID id) {
        jdbcTemplate.update("delete from common_areas where id=?", id);
        return MapResponseDto.of(Map.of("ok", true));
    }

    @PostMapping("/blocks/{blockId}/common-areas/clear")
    public MapResponseDto clearCommon(@PathVariable UUID blockId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        String floorIds = String.valueOf(body.getOrDefault("floorIds", ""));
        if (floorIds.isBlank()) {
            jdbcTemplate.update("delete from common_areas where floor_id in (select id from floors where block_id=?)", blockId);
        } else {
            for (String f : floorIds.split(",")) jdbcTemplate.update("delete from common_areas where floor_id=?", UUID.fromString(f.trim()));
        }
        return MapResponseDto.of(Map.of("ok", true));
    }

    @GetMapping("/blocks/{blockId}/common-areas")
    public ItemsResponseDto commonAreas(@PathVariable UUID blockId, @RequestParam(required = false) String floorIds) {
        if (floorIds == null || floorIds.isBlank()) {
            return new ItemsResponseDto(jdbcTemplate.queryForList("select ca.* from common_areas ca join floors f on f.id=ca.floor_id where f.block_id=?", blockId));
        }
        List<String> arr = Arrays.stream(floorIds.split(",")).map(String::trim).toList();
        String in = String.join(",", Collections.nCopies(arr.size(), "?"));
        return new ItemsResponseDto(jdbcTemplate.queryForList("select * from common_areas where floor_id in (" + in + ")", arr.toArray()));
    }

    @GetMapping("/blocks/{blockId}/entrance-matrix")
    public ItemsResponseDto matrix(@PathVariable UUID blockId) {
        return new ItemsResponseDto(jdbcTemplate.queryForList("select * from entrance_matrix where block_id=? order by entrance_number", blockId));
    }

    @PutMapping("/floors/{floorId}")
    public MapResponseDto updateFloor(@PathVariable UUID floorId, @RequestBody(required = false) MapPayloadDto payload) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        Map<String, Object> updates = asMap(body.get("updates"));
        Map<String, Object> mapped = mapFloorUpdatesToPayload(updates);

        if (mapped.isEmpty()) {
            throw new ApiException("updates are required", "VALIDATION_ERROR", null, 400);
        }

        int affected = jdbcTemplate.update(
            "update floors set label=coalesce(?,label), floor_type=coalesce(?,floor_type), height=coalesce(?,height), area_proj=coalesce(?,area_proj), area_fact=coalesce(?,area_fact), is_duplex=coalesce(?,is_duplex), is_technical=coalesce(?,is_technical), is_commercial=coalesce(?,is_commercial), updated_at=now() where id=?",
            mapped.get("label"),
            mapped.get("floor_type"),
            mapped.get("height"),
            mapped.get("area_proj"),
            mapped.get("area_fact"),
            mapped.get("is_duplex"),
            mapped.get("is_technical"),
            mapped.get("is_commercial"),
            floorId
        );
        if (affected == 0) {
            throw new ApiException("Floor not found", "NOT_FOUND", null, 404);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList("select * from floors where id=?", floorId);
        return MapResponseDto.of(rows.get(0));
    }

    @PutMapping("/floors/batch")
    public MapResponseDto updateFloorsBatch(@RequestBody(required = false) MapPayloadDto payload) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        List<Map<String, Object>> items = asList(body.get("items"));
        boolean strict = toBool(body.get("strict"));
        if (items.isEmpty()) {
            return MapResponseDto.of(Map.of("ok", true, "updated", 0, "failed", List.of()));
        }

        List<Map<String, Object>> failed = new ArrayList<>();
        List<Map<String, Object>> toUpdate = new ArrayList<>();

        for (int index = 0; index < items.size(); index++) {
            Map<String, Object> item = items.get(index);
            UUID floorId = parseUuid(item.get("id"));
            if (floorId == null) {
                failed.add(Map.of("index", index, "reason", "id is required"));
                continue;
            }
            Map<String, Object> mapped = mapFloorUpdatesToPayload(asMap(item.get("updates")));
            if (mapped.isEmpty()) {
                failed.add(Map.of("index", index, "id", floorId.toString(), "reason", "updates are required"));
                continue;
            }
            Map<String, Object> row = new HashMap<>(mapped);
            row.put("id", floorId);
            row.put("index", index);
            toUpdate.add(row);
        }

        if (!toUpdate.isEmpty()) {
            List<UUID> floorIds = toUpdate.stream().map(r -> (UUID) r.get("id")).toList();
            String in = String.join(",", Collections.nCopies(floorIds.size(), "?"));
            List<Map<String, Object>> existing = jdbcTemplate.queryForList("select id from floors where id in (" + in + ")", floorIds.toArray());
            Set<UUID> existingIds = existing.stream().map(r -> UUID.fromString(String.valueOf(r.get("id")))).collect(Collectors.toSet());

            List<Map<String, Object>> filtered = new ArrayList<>();
            for (Map<String, Object> row : toUpdate) {
                UUID id = (UUID) row.get("id");
                if (!existingIds.contains(id)) {
                    failed.add(Map.of("index", row.get("index"), "id", id.toString(), "reason", "floor not found"));
                } else {
                    filtered.add(row);
                }
            }

            if (strict && !failed.isEmpty()) {
                throw new ApiException("One or more floors cannot be updated", "PARTIAL_UPDATE", Map.of("failed", failed), 409);
            }

            for (Map<String, Object> row : filtered) {
                jdbcTemplate.update(
                    "update floors set label=coalesce(?,label), floor_type=coalesce(?,floor_type), height=coalesce(?,height), area_proj=coalesce(?,area_proj), area_fact=coalesce(?,area_fact), is_duplex=coalesce(?,is_duplex), is_technical=coalesce(?,is_technical), is_commercial=coalesce(?,is_commercial), updated_at=now() where id=?",
                    row.get("label"),
                    row.get("floor_type"),
                    row.get("height"),
                    row.get("area_proj"),
                    row.get("area_fact"),
                    row.get("is_duplex"),
                    row.get("is_technical"),
                    row.get("is_commercial"),
                    row.get("id")
                );
            }

            return MapResponseDto.of(Map.of("ok", failed.isEmpty(), "updated", filtered.size(), "failed", failed));
        }

        return MapResponseDto.of(Map.of("ok", failed.isEmpty(), "updated", 0, "failed", failed));
    }


    @PostMapping("/blocks/{blockId}/floors/reconcile")
    public MapResponseDto reconcileFloors(@PathVariable UUID blockId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        BuildingBlockEntity block = blockRepo.findById(blockId).orElseThrow(() -> new ApiException("Block not found", "NOT_FOUND", null, 404));
        BuildingEntity building = buildingRepo.findById(block.getBuildingId()).orElseThrow(() -> new ApiException("Building not found", "NOT_FOUND", null, 404));
        List<BuildingBlockEntity> allBlocks = blockRepo.findByBuildingId(block.getBuildingId());
        List<BlockFloorMarkerEntity> markers = markerRepo.findByBlockIdIn(List.of(blockId));

        List<Map<String, Object>> existingFloors = jdbcTemplate.queryForList(
            "select id, index, parent_floor_index, basement_id from floors where block_id=?",
            blockId
        );
        List<Map<String, Object>> generated = floorGeneratorService.generateFloorsModel(block, building, allBlocks, markers);
        Set<String> seenKeys = new HashSet<>();
        List<Map<String, Object>> targetModel = generated.stream().filter(floor -> seenKeys.add(floorConstraintKey(floor))).toList();

        Map<String, Map<String, Object>> existingByKey = existingFloors.stream()
            .collect(Collectors.toMap(this::floorConstraintKey, row -> row, (a, b) -> a));

        List<UUID> usedExistingIds = new ArrayList<>();
        List<Map<String, Object>> toUpsert = new ArrayList<>();
        Instant now = Instant.now();

        for (Map<String, Object> floor : targetModel) {
            String cKey = floorConstraintKey(floor);
            Map<String, Object> existing = existingByKey.get(cKey);
            UUID id = existing == null ? UUID.randomUUID() : UUID.fromString(String.valueOf(existing.get("id")));
            if (existing != null) usedExistingIds.add(id);
            Map<String, Object> floorPayload = new HashMap<>(floor);
            floorPayload.put("id", id);
            floorPayload.put("updated_at", now);
            toUpsert.add(floorPayload);
        }

        List<UUID> toDeleteIds = existingFloors.stream()
            .map(row -> UUID.fromString(String.valueOf(row.get("id"))))
            .filter(id -> !usedExistingIds.contains(id))
            .toList();

        if (!toDeleteIds.isEmpty()) {
            Map<UUID, UUID> floorRemap = buildFloorRemap(toDeleteIds, toUpsert);
            remapFloorReferences(floorRemap);
        }

        if (!toDeleteIds.isEmpty()) {
            String in = String.join(",", Collections.nCopies(toDeleteIds.size(), "?"));
            jdbcTemplate.update("delete from floors where id in (" + in + ")", toDeleteIds.toArray());
        }

        for (Map<String, Object> floor : toUpsert) {
            jdbcTemplate.update(
                "insert into floors(id, block_id, index, floor_key, label, floor_type, height, area_proj, is_technical, is_commercial, is_stylobate, is_basement, is_attic, is_loft, is_roof, parent_floor_index, basement_id, updated_at) " +
                    "values (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) " +
                    "on conflict (id) do update set block_id=excluded.block_id, index=excluded.index, floor_key=excluded.floor_key, label=excluded.label, floor_type=excluded.floor_type, height=excluded.height, area_proj=excluded.area_proj, is_technical=excluded.is_technical, is_commercial=excluded.is_commercial, is_stylobate=excluded.is_stylobate, is_basement=excluded.is_basement, is_attic=excluded.is_attic, is_loft=excluded.is_loft, is_roof=excluded.is_roof, parent_floor_index=excluded.parent_floor_index, basement_id=excluded.basement_id, updated_at=excluded.updated_at",
                floor.get("id"), floor.get("block_id"), floor.get("index"), floor.get("floor_key"), floor.get("label"), floor.get("floor_type"), floor.get("height"), floor.get("area_proj"),
                floor.get("is_technical"), floor.get("is_commercial"), floor.get("is_stylobate"), floor.get("is_basement"), floor.get("is_attic"), floor.get("is_loft"), floor.get("is_roof"),
                floor.get("parent_floor_index"), floor.get("basement_id"), floor.get("updated_at")
            );
        }

        ensureEntranceMatrixForBlock(blockId);
        return MapResponseDto.of(Map.of("ok", true, "deleted", toDeleteIds.size(), "upserted", toUpsert.size()));
    }

    @PostMapping("/blocks/{blockId}/entrances/reconcile")
    public MapResponseDto reconcileEntrances(@PathVariable UUID blockId, @RequestBody(required = false) MapPayloadDto payload) {
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        int count = Math.max(0, Optional.ofNullable(toNullableInt(body.get("count"))).orElse(0));

        List<Map<String, Object>> existing = jdbcTemplate.queryForList("select id, number from entrances where block_id=? order by number", blockId);
        Set<Integer> present = existing.stream().map(x -> ((Number) x.get("number")).intValue()).collect(Collectors.toSet());

        int created = 0;
        for (int i = 1; i <= count; i++) {
            if (!present.contains(i)) {
                jdbcTemplate.update("insert into entrances(id,block_id,number,created_at,updated_at) values (gen_random_uuid(),?,?,now(),now())", blockId, i);
                created += 1;
            }
        }

        List<UUID> deleteIds = existing.stream()
            .filter(row -> ((Number) row.get("number")).intValue() > count)
            .map(row -> UUID.fromString(String.valueOf(row.get("id"))))
            .toList();
        if (!deleteIds.isEmpty()) {
            String in = String.join(",", Collections.nCopies(deleteIds.size(), "?"));
            jdbcTemplate.update("delete from entrances where id in (" + in + ")", deleteIds.toArray());
        }

        ensureEntranceMatrixForBlock(blockId);
        return MapResponseDto.of(Map.of("ok", true, "count", count, "created", created, "deleted", deleteIds.size()));
    }

    private Map<UUID, UUID> buildFloorRemap(List<UUID> removedFloorIds, List<Map<String, Object>> toUpsert) {
        List<Map<String, Object>> removedFloors = jdbcTemplate.queryForList(
            "select id, index from floors where id in (" + String.join(",", Collections.nCopies(removedFloorIds.size(), "?")) + ")",
            removedFloorIds.toArray()
        );

        Map<UUID, Integer> removedIndex = new HashMap<>();
        for (Map<String, Object> row : removedFloors) {
            removedIndex.put(UUID.fromString(String.valueOf(row.get("id"))), toInt(row.get("index"), 0));
        }

        List<Map<String, Object>> targetFloors = toUpsert.stream().toList();
        Map<UUID, UUID> remap = new HashMap<>();
        for (UUID oldFloorId : removedFloorIds) {
            int oldIdx = removedIndex.getOrDefault(oldFloorId, 0);
            UUID candidate = targetFloors.stream()
                .min(Comparator.comparingInt(row -> Math.abs(toInt(row.get("index"), 0) - oldIdx)))
                .map(row -> UUID.fromString(String.valueOf(row.get("id"))))
                .orElse(null);
            if (candidate != null && !candidate.equals(oldFloorId)) {
                remap.put(oldFloorId, candidate);
            }
        }
        return remap;
    }

    private void remapFloorReferences(Map<UUID, UUID> floorRemap) {
        for (Map.Entry<UUID, UUID> entry : floorRemap.entrySet()) {
            jdbcTemplate.update("update units set floor_id=?, updated_at=now() where floor_id=?", entry.getValue(), entry.getKey());
            jdbcTemplate.update("update common_areas set floor_id=?, updated_at=now() where floor_id=?", entry.getValue(), entry.getKey());
            jdbcTemplate.update("update entrance_matrix set floor_id=?, updated_at=now() where floor_id=?", entry.getValue(), entry.getKey());
        }
    }

    private void remapEntranceReferences(UUID blockId, UUID removeId, UUID targetEntranceId) {
        jdbcTemplate.update("update units set entrance_id=?, updated_at=now() where entrance_id=?", targetEntranceId, removeId);
        jdbcTemplate.update("update common_areas set entrance_id=?, updated_at=now() where entrance_id=?", targetEntranceId, removeId);

        Integer targetNumber = jdbcTemplate.queryForObject("select number from entrances where id=?", Integer.class, targetEntranceId);
        Integer removeNumber = jdbcTemplate.queryForObject("select number from entrances where id=?", Integer.class, removeId);
        if (targetNumber != null && removeNumber != null) {
            List<Map<String, Object>> movingRows = jdbcTemplate.queryForList(
                "select floor_id, flats_count, commercial_count, mop_count from entrance_matrix where block_id=? and entrance_number=?",
                blockId,
                removeNumber
            );

            for (Map<String, Object> row : movingRows) {
                jdbcTemplate.update(
                    "insert into entrance_matrix(id,block_id,floor_id,entrance_number,flats_count,commercial_count,mop_count,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,now()) " +
                        "on conflict (block_id,floor_id,entrance_number) do update set flats_count=coalesce(entrance_matrix.flats_count,0)+coalesce(excluded.flats_count,0), " +
                        "commercial_count=coalesce(entrance_matrix.commercial_count,0)+coalesce(excluded.commercial_count,0), " +
                        "mop_count=coalesce(entrance_matrix.mop_count,0)+coalesce(excluded.mop_count,0), updated_at=now()",
                    blockId,
                    row.get("floor_id"),
                    targetNumber,
                    row.get("flats_count"),
                    row.get("commercial_count"),
                    row.get("mop_count")
                );
            }

            jdbcTemplate.update("delete from entrance_matrix where block_id=? and entrance_number=?", blockId, removeNumber);
        }
    }

    @PutMapping("/blocks/{blockId}/entrance-matrix/cell")
    public MapResponseDto upsertCell(@PathVariable UUID blockId, @RequestBody(required = false) MapPayloadDto payload) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        UUID floorId = parseUuid(body.get("floorId"));
        Integer entranceNumber = toNullableInt(body.get("entranceNumber"));
        if (floorId == null || entranceNumber == null) {
            throw new ApiException("floorId and entranceNumber are required", "VALIDATION_ERROR", null, 400);
        }

        MatrixValidationResult validated = validateMatrixValues(asMap(body.get("values")));

        jdbcTemplate.update(
            "insert into entrance_matrix(id,block_id,floor_id,entrance_number,flats_count,commercial_count,mop_count,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,now()) on conflict (block_id,floor_id,entrance_number) do update set flats_count=excluded.flats_count, commercial_count=excluded.commercial_count, mop_count=excluded.mop_count, updated_at=now()",
            blockId,
            floorId,
            entranceNumber,
            validated.flatsCount,
            validated.commercialCount,
            validated.mopCount
        );

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "select * from entrance_matrix where block_id=? and floor_id=? and entrance_number=? limit 1",
            blockId,
            floorId,
            entranceNumber
        );
        return MapResponseDto.of(rows.isEmpty() ? Map.of("ok", true) : rows.get(0));
    }

    @PutMapping("/blocks/{blockId}/entrance-matrix/batch")
    public MapResponseDto upsertMatrixBatch(@PathVariable UUID blockId, @RequestBody(required = false) MapPayloadDto payload) {
        requirePolicy("registry", "mutate", "Role cannot modify registry data");
        Map<String, Object> body = payload == null || payload.data() == null ? Map.of() : payload.data();
        List<Map<String, Object>> cells = asList(body.get("cells"));
        if (cells.isEmpty()) {
            return MapResponseDto.of(Map.of("ok", true, "updated", 0, "failed", List.of()));
        }

        List<Map<String, Object>> failed = new ArrayList<>();
        List<Map<String, Object>> valid = new ArrayList<>();

        for (int index = 0; index < cells.size(); index++) {
            Map<String, Object> cell = cells.get(index);
            UUID floorId = parseUuid(cell.get("floorId"));
            Integer entranceNumber = toNullableInt(cell.get("entranceNumber"));
            if (floorId == null || entranceNumber == null) {
                failed.add(Map.of("index", index, "reason", "floorId and entranceNumber are required"));
                continue;
            }
            try {
                MatrixValidationResult validated = validateMatrixValues(asMap(cell.get("values")));
                valid.add(Map.of(
                    "floorId", floorId,
                    "entranceNumber", entranceNumber,
                    "flatsCount", validated.flatsCount,
                    "commercialCount", validated.commercialCount,
                    "mopCount", validated.mopCount
                ));
            } catch (ApiException ex) {
                failed.add(Map.of(
                    "index", index,
                    "floorId", floorId.toString(),
                    "entranceNumber", entranceNumber,
                    "reason", ex.getMessage()
                ));
            }
        }

        for (Map<String, Object> row : valid) {
            jdbcTemplate.update(
                "insert into entrance_matrix(id,block_id,floor_id,entrance_number,flats_count,commercial_count,mop_count,updated_at) values (gen_random_uuid(),?,?,?,?,?,?,now()) on conflict (block_id,floor_id,entrance_number) do update set flats_count=excluded.flats_count, commercial_count=excluded.commercial_count, mop_count=excluded.mop_count, updated_at=now()",
                blockId,
                row.get("floorId"),
                row.get("entranceNumber"),
                row.get("flatsCount"),
                row.get("commercialCount"),
                row.get("mopCount")
            );
        }

        return MapResponseDto.of(Map.of("ok", true, "updated", valid.size(), "failed", failed));
    }

    @PostMapping("/blocks/{blockId}/reconcile/preview")
    public ResponseEntity<MapResponseDto> preview(@PathVariable UUID blockId) {
        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<UUID> floorIds = floors.stream().map(row -> UUID.fromString(String.valueOf(row.get("id")))).toList();
        if (floorIds.isEmpty()) {
            return ResponseEntity.ok(MapResponseDto.of(Map.of(
                "units", Map.of("toRemove", 0, "checkedCells", 0),
                "commonAreas", Map.of("toRemove", 0, "checkedCells", 0)
            )));
        }

        Map<Integer, UUID> entranceByNumber = loadEntranceMap(blockId);
        Map<String, Map<String, Integer>> desiredUnitsMap = new HashMap<>();
        Map<String, Integer> desiredMopsMap = new HashMap<>();
        List<Map<String, Object>> matrixRows = jdbcTemplate.queryForList(
            "select floor_id, entrance_number, flats_count, commercial_count, mop_count from entrance_matrix where block_id=?",
            blockId
        );
        for (Map<String, Object> row : matrixRows) {
            UUID entranceId = entranceByNumber.get(toNullableInt(row.get("entrance_number")));
            if (entranceId == null) continue;
            String key = row.get("floor_id") + "_" + entranceId;
            desiredUnitsMap.put(key, Map.of("flats", Math.max(0, toInt(row.get("flats_count"), 0)), "commercial", Math.max(0, toInt(row.get("commercial_count"), 0))));
            desiredMopsMap.put(key, Math.max(0, toInt(row.get("mop_count"), 0)));
        }

        String inFloors = String.join(",", Collections.nCopies(floorIds.size(), "?"));
        List<Map<String, Object>> units = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_id, unit_type, created_at from units where floor_id in (" + inFloors + ")",
            floorIds.toArray()
        );
        List<Map<String, Object>> areas = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_id, created_at from common_areas where floor_id in (" + inFloors + ")",
            floorIds.toArray()
        );

        Map<String, Integer> flatsByKey = new HashMap<>();
        Map<String, Integer> commercialByKey = new HashMap<>();
        for (Map<String, Object> unit : units) {
            String type = String.valueOf(unit.get("unit_type"));
            String key = unit.get("floor_id") + "_" + unit.get("entrance_id");
            if (isFlatType(type)) flatsByKey.put(key, flatsByKey.getOrDefault(key, 0) + 1);
            else if (isCommercialType(type)) commercialByKey.put(key, commercialByKey.getOrDefault(key, 0) + 1);
        }

        Set<String> unitKeys = new HashSet<>();
        unitKeys.addAll(flatsByKey.keySet());
        unitKeys.addAll(commercialByKey.keySet());
        int unitsToRemove = 0;
        for (String key : unitKeys) {
            Map<String, Integer> desired = desiredUnitsMap.getOrDefault(key, Map.of("flats", 0, "commercial", 0));
            unitsToRemove += Math.max(0, flatsByKey.getOrDefault(key, 0) - desired.get("flats"));
            unitsToRemove += Math.max(0, commercialByKey.getOrDefault(key, 0) - desired.get("commercial"));
        }

        Map<String, Integer> mopsByKey = new HashMap<>();
        for (Map<String, Object> area : areas) {
            String key = area.get("floor_id") + "_" + area.get("entrance_id");
            mopsByKey.put(key, mopsByKey.getOrDefault(key, 0) + 1);
        }
        int mopsToRemove = 0;
        for (Map.Entry<String, Integer> entry : mopsByKey.entrySet()) {
            mopsToRemove += Math.max(0, entry.getValue() - desiredMopsMap.getOrDefault(entry.getKey(), 0));
        }

        return ResponseEntity.ok(MapResponseDto.of(Map.of(
            "units", Map.of("toRemove", unitsToRemove, "checkedCells", unitKeys.size()),
            "commonAreas", Map.of("toRemove", mopsToRemove, "checkedCells", mopsByKey.size())
        )));
    }

    private Map<Integer, UUID> loadEntranceMap(UUID blockId) {
        List<Map<String, Object>> entrances = jdbcTemplate.queryForList("select id, number from entrances where block_id=?", blockId);
        Map<Integer, UUID> entranceByNumber = new HashMap<>();
        for (Map<String, Object> entrance : entrances) {
            entranceByNumber.put(toInt(entrance.get("number"), 0), UUID.fromString(String.valueOf(entrance.get("id"))));
        }
        return entranceByNumber;
    }

    private void ensureEntranceMatrixForBlock(UUID blockId) {
        List<Map<String, Object>> floors = jdbcTemplate.queryForList("select id from floors where block_id=?", blockId);
        List<Map<String, Object>> entrances = jdbcTemplate.queryForList("select number from entrances where block_id=?", blockId);

        List<UUID> floorIds = floors.stream().map(row -> UUID.fromString(String.valueOf(row.get("id")))).toList();
        List<Integer> entranceNumbers = entrances.stream().map(row -> toInt(row.get("number"), -1)).filter(n -> n > 0).toList();

        if (floorIds.isEmpty() || entranceNumbers.isEmpty()) {
            jdbcTemplate.update("delete from entrance_matrix where block_id=?", blockId);
            return;
        }

        List<Map<String, Object>> existingRows = jdbcTemplate.queryForList(
            "select id, floor_id, entrance_number from entrance_matrix where block_id=?",
            blockId
        );

        Set<UUID> floorSet = new HashSet<>(floorIds);
        Set<Integer> entranceSet = new HashSet<>(entranceNumbers);
        Set<String> existingKeys = new HashSet<>();
        List<UUID> staleIds = new ArrayList<>();

        for (Map<String, Object> row : existingRows) {
            UUID floorId = UUID.fromString(String.valueOf(row.get("floor_id")));
            int entranceNumber = toInt(row.get("entrance_number"), 0);
            if (!floorSet.contains(floorId) || !entranceSet.contains(entranceNumber)) {
                staleIds.add(UUID.fromString(String.valueOf(row.get("id"))));
                continue;
            }
            existingKeys.add(floorId + "|" + entranceNumber);
        }

        if (!staleIds.isEmpty()) {
            String in = String.join(",", Collections.nCopies(staleIds.size(), "?"));
            jdbcTemplate.update("delete from entrance_matrix where id in (" + in + ")", staleIds.toArray());
        }

        for (UUID floorId : floorIds) {
            for (Integer entranceNumber : entranceNumbers) {
                String key = floorId + "|" + entranceNumber;
                if (existingKeys.contains(key)) continue;
                jdbcTemplate.update(
                    "insert into entrance_matrix(id, block_id, floor_id, entrance_number, updated_at) values (gen_random_uuid(),?,?,?,?,now()) on conflict (block_id,floor_id,entrance_number) do nothing",
                    blockId,
                    floorId,
                    entranceNumber
                );
            }
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> asMap(Object value) {
        if (value instanceof Map<?, ?> map) return (Map<String, Object>) map;
        return Map.of();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> asList(Object value) {
        if (!(value instanceof List<?> list)) return List.of();
        return list.stream().filter(Map.class::isInstance).map(v -> (Map<String, Object>) v).toList();
    }

    private boolean toBool(Object value) {
        if (value instanceof Boolean b) return b;
        return value != null && Boolean.parseBoolean(String.valueOf(value));
    }

    private UUID parseUuid(Object value) {
        if (value == null) return null;
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (Exception e) {
            return null;
        }
    }

    private Map<String, Object> mapFloorUpdatesToPayload(Map<String, Object> updates) {
        Map<String, Object> payload = new HashMap<>();
        if (updates.containsKey("height")) payload.put("height", parseNullableDecimal(updates.get("height"), "height"));
        if (updates.containsKey("areaProj")) payload.put("area_proj", parseNullableDecimal(updates.get("areaProj"), "areaProj"));
        if (updates.containsKey("areaFact")) payload.put("area_fact", parseNullableDecimal(updates.get("areaFact"), "areaFact"));
        if (updates.containsKey("isDuplex")) payload.put("is_duplex", updates.get("isDuplex"));
        if (updates.containsKey("label")) payload.put("label", updates.get("label"));
        if (updates.containsKey("type")) payload.put("floor_type", updates.get("type"));
        if (updates.containsKey("isTechnical")) payload.put("is_technical", updates.get("isTechnical"));
        if (updates.containsKey("isCommercial")) payload.put("is_commercial", updates.get("isCommercial"));
        return payload;
    }

    private BigDecimal parseNullableDecimal(Object value, String fieldName) {
        if (value == null) return null;
        String normalized = String.valueOf(value).trim();
        if (normalized.isEmpty()) return null;
        normalized = normalized.replace(',', '.');
        try {
            return new BigDecimal(normalized);
        } catch (Exception e) {
            throw new ApiException(fieldName + " must be a valid number or empty", "VALIDATION_ERROR", null, 400);
        }
    }

    private MatrixValidationResult validateMatrixValues(Map<String, Object> values) {
        boolean hasApts = values.containsKey("apts");
        boolean hasUnits = values.containsKey("units");
        boolean hasMops = values.containsKey("mopQty");
        if (!hasApts && !hasUnits && !hasMops) {
            throw new ApiException("values must include at least one field: apts, units, mopQty", "VALIDATION_ERROR", null, 400);
        }

        int maxAllowed = 500;
        Integer flatsCount = null;
        Integer commercialCount = null;
        Integer mopCount = null;

        if (hasApts) {
            flatsCount = parseNonNegativeIntOrNull(values.get("apts"));
            if (flatsCount == null && values.get("apts") != null && !String.valueOf(values.get("apts")).isBlank()) {
                throw new ApiException("apts must be a non-negative integer or empty", "VALIDATION_ERROR", null, 400);
            }
            if (flatsCount != null && flatsCount > maxAllowed) {
                throw new ApiException("apts must be <= " + maxAllowed, "VALIDATION_ERROR", null, 400);
            }
        }

        if (hasUnits) {
            commercialCount = parseNonNegativeIntOrNull(values.get("units"));
            if (commercialCount == null && values.get("units") != null && !String.valueOf(values.get("units")).isBlank()) {
                throw new ApiException("units must be a non-negative integer or empty", "VALIDATION_ERROR", null, 400);
            }
            if (commercialCount != null && commercialCount > maxAllowed) {
                throw new ApiException("units must be <= " + maxAllowed, "VALIDATION_ERROR", null, 400);
            }
        }

        if (hasMops) {
            mopCount = parseNonNegativeIntOrNull(values.get("mopQty"));
            if (mopCount == null && values.get("mopQty") != null && !String.valueOf(values.get("mopQty")).isBlank()) {
                throw new ApiException("mopQty must be a non-negative integer or empty", "VALIDATION_ERROR", null, 400);
            }
            if (mopCount != null && mopCount > maxAllowed) {
                throw new ApiException("mopQty must be <= " + maxAllowed, "VALIDATION_ERROR", null, 400);
            }
        }

        return new MatrixValidationResult(flatsCount, commercialCount, mopCount);
    }

    private Integer parseNonNegativeIntOrNull(Object value) {
        if (value == null) return null;
        String raw = String.valueOf(value).trim();
        if (raw.isEmpty()) return null;
        try {
            int parsed = Integer.parseInt(raw);
            return parsed < 0 ? null : parsed;
        } catch (Exception e) {
            return null;
        }
    }

    private static final class MatrixValidationResult {
        private final Integer flatsCount;
        private final Integer commercialCount;
        private final Integer mopCount;

        private MatrixValidationResult(Integer flatsCount, Integer commercialCount, Integer mopCount) {
            this.flatsCount = flatsCount;
            this.commercialCount = commercialCount;
            this.mopCount = mopCount;
        }
    }

    private String floorConstraintKey(Map<String, Object> floor) {
        int index = toInt(floor.get("index"), 0);
        int parent = floor.get("parent_floor_index") == null ? -99999 : toInt(floor.get("parent_floor_index"), -99999);
        String basementId = String.valueOf(floor.getOrDefault("basement_id", "00000000-0000-0000-0000-000000000000"));
        return index + "_" + parent + "_" + basementId;
    }

    private int toInt(Object value, Integer fallback) {
        if (value == null) return fallback;
        if (value instanceof Number number) return number.intValue();
        return Integer.parseInt(String.valueOf(value));
    }

    private Integer toNullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number number) return number.intValue();
        return Integer.parseInt(String.valueOf(value));
    }

    private Instant toInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value == null) return Instant.EPOCH;
        return Instant.parse(String.valueOf(value));
    }

    private boolean isFlatType(String type) {
        return Set.of(UnitType.FLAT.value(), UnitType.DUPLEX_UP.value(), UnitType.DUPLEX_DOWN.value(), UnitType.PANTRY.value()).contains(type);
    }

    private boolean isCommercialType(String type) {
        return Set.of(UnitType.OFFICE.value()).contains(type);
    }

    private void saveMopRow(Map<String, Object> data) {
        UUID floorId = parseRequiredUuid(data.get("floorId"), "floorId");
        UUID entranceId = parseRequiredUuid(data.get("entranceId"), "entranceId");
        BigDecimal area = parseRequiredDecimal(data.get("area"), "area");
        BigDecimal height = parseRequiredDecimal(data.get("height"), "height");
        String type = String.valueOf(data.getOrDefault("type", "")).trim();
        if (type.isBlank()) {
            throw new ApiException("type is required", "VALIDATION_ERROR", null, 400);
        }

        UUID persistedId = parsePersistedUuid(data.get("id"));
        if (persistedId == null) {
            jdbcTemplate.update(
                "insert into common_areas(id,floor_id,entrance_id,type,area,height,updated_at,created_at) values (gen_random_uuid(),?,?,?,?,?,now(),now())",
                floorId, entranceId, type, area, height
            );
        } else {
            jdbcTemplate.update(
                "update common_areas set floor_id=?, entrance_id=?, type=?, area=?, height=?, updated_at=now() where id=?",
                floorId, entranceId, type, area, height, persistedId
            );
        }
    }

    private UUID parsePersistedUuid(Object rawId) {
        if (rawId == null) {
            return null;
        }
        String value = String.valueOf(rawId).trim();
        if (value.isBlank() || value.startsWith("temp-")) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException ex) {
            throw new ApiException("Invalid id format: " + value, "VALIDATION_ERROR", null, 400);
        }
    }

    private UUID parseRequiredUuid(Object value, String fieldName) {
        if (value == null) {
            throw new ApiException(fieldName + " is required", "VALIDATION_ERROR", null, 400);
        }
        try {
            return UUID.fromString(String.valueOf(value));
        } catch (IllegalArgumentException ex) {
            throw new ApiException(fieldName + " must be UUID", "VALIDATION_ERROR", null, 400);
        }
    }

    private BigDecimal parseRequiredDecimal(Object value, String fieldName) {
        if (value == null) {
            throw new ApiException(fieldName + " is required", "VALIDATION_ERROR", null, 400);
        }
        String str = String.valueOf(value).trim();
        if (str.isBlank()) {
            throw new ApiException(fieldName + " is required", "VALIDATION_ERROR", null, 400);
        }
        try {
            return new BigDecimal(str);
        } catch (NumberFormatException ex) {
            throw new ApiException(fieldName + " must be numeric", "VALIDATION_ERROR", null, 400);
        }
    }

    private boolean hasCadastreNumber(Map<String, Object> row) {
        Object value = row.get("cadastre_number");
        return value != null && !String.valueOf(value).isBlank();
    }

    private boolean hasAreaData(Map<String, Object> row) {
        return toNullableInt(row.get("total_area")) != null
            || toNullableInt(row.get("living_area")) != null
            || toNullableInt(row.get("useful_area")) != null;
    }

    private void requirePolicy(String module, String action, String message) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ActorPrincipal actor)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
        if (!securityPolicyService.allowByPolicy(actor.userRole(), module, action)) {
            throw new ApiException(message, "FORBIDDEN", null, 403);
        }
    }
}
