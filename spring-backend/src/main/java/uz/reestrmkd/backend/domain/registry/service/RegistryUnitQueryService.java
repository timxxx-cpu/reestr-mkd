package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.domain.registry.model.RoomEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.RoomJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class RegistryUnitQueryService {

    private final UnitJpaRepository unitJpaRepository;
    private final RoomJpaRepository roomJpaRepository;

    public RegistryUnitQueryService(UnitJpaRepository unitJpaRepository, RoomJpaRepository roomJpaRepository) {
        this.unitJpaRepository = unitJpaRepository;
        this.roomJpaRepository = roomJpaRepository;
    }

    public Map<String, Object> loadUnitExplication(@NonNull UUID unitId) {
        UnitEntity unitEntity = unitJpaRepository.findById(unitId).orElse(null);
        if (unitEntity == null) {
            return null;
        }

        Map<String, Object> unit = new HashMap<>();
        unit.put("id", unitEntity.getId());
        unit.put("floor_id", unitEntity.getFloorId());
        unit.put("extension_id", unitEntity.getExtensionId());
        unit.put("entrance_id", unitEntity.getEntranceId());
        unit.put("unit_code", unitEntity.getUnitCode());
        unit.put("number", unitEntity.getNumber());
        unit.put("unit_type", unitEntity.getUnitType());
        unit.put("has_mezzanine", unitEntity.getHasMezzanine());
        unit.put("mezzanine_type", unitEntity.getMezzanineType());
        unit.put("total_area", unitEntity.getTotalArea());
        unit.put("living_area", unitEntity.getLivingArea());
        unit.put("useful_area", unitEntity.getUsefulArea());
        unit.put("rooms_count", unitEntity.getRoomsCount());
        unit.put("status", unitEntity.getStatus());
        unit.put("cadastre_number", unitEntity.getCadastreNumber());
        unit.put("address_id", unitEntity.getAddressId());
        unit.put("created_at", unitEntity.getCreatedAt());
        unit.put("updated_at", unitEntity.getUpdatedAt());

        List<Map<String, Object>> rooms = roomJpaRepository.findByUnit_IdIn(List.of(unitId)).stream()
            .map(this::toRoomMap)
            .toList();

        unit.put("rooms", rooms);
        return unit;
    }

    private Map<String, Object> toRoomMap(RoomEntity room) {
        Map<String, Object> mapped = new HashMap<>();
        mapped.put("id", room.getId());
        mapped.put("unit_id", room.getUnitId());
        mapped.put("room_type", room.getRoomType());
        mapped.put("name", room.getName());
        mapped.put("area", room.getArea());
        mapped.put("room_height", room.getRoomHeight());
        mapped.put("level", room.getLevel());
        mapped.put("is_mezzanine", room.getIsMezzanine());
        mapped.put("created_at", room.getCreatedAt());
        mapped.put("updated_at", room.getUpdatedAt());

        mapped.put("type", room.getRoomType());
        mapped.put("label", room.getName());
        mapped.put("height", room.getRoomHeight());
        mapped.put("isMezzanine", Boolean.TRUE.equals(room.getIsMezzanine()));
        return mapped;
    }
}