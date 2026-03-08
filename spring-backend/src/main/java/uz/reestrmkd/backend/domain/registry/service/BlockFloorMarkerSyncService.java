package uz.reestrmkd.backend.domain.registry.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backend.domain.registry.model.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class BlockFloorMarkerSyncService {

    private static final String TECHNICAL_SUFFIX = "-Р Сћ";

    private final BlockFloorMarkerJpaRepository blockFloorMarkerJpaRepository;

    public BlockFloorMarkerSyncService(BlockFloorMarkerJpaRepository blockFloorMarkerJpaRepository) {
        this.blockFloorMarkerJpaRepository = blockFloorMarkerJpaRepository;
    }

    @Transactional
    public void sync(UUID blockId, Map<String, Object> details) {
        Set<String> technicalKeys = new HashSet<>();
        Object technicalFloors = details.get("technicalFloors");
        if (technicalFloors instanceof List<?> list) {
            for (Object raw : list) {
                String markerKey = null;
                if (raw instanceof String s && s.contains(TECHNICAL_SUFFIX)) {
                    markerKey = s;
                } else {
                    Integer parsed = toNullableInt(raw);
                    if (parsed != null) {
                        markerKey = parsed + TECHNICAL_SUFFIX;
                    }
                }
                if (markerKey != null) {
                    technicalKeys.add(markerKey);
                }
            }
        }

        Set<String> commercialKeys = new HashSet<>();
        Object commercialFloors = details.get("commercialFloors");
        if (commercialFloors instanceof List<?> list) {
            for (Object raw : list) {
                if (raw != null) {
                    commercialKeys.add(String.valueOf(raw));
                }
            }
        }

        blockFloorMarkerJpaRepository.deleteByBlockId(blockId);

        LinkedHashSet<String> markerKeys = new LinkedHashSet<>();
        markerKeys.addAll(technicalKeys);
        markerKeys.addAll(commercialKeys);

        if (markerKeys.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        List<BlockFloorMarkerEntity> markers = new ArrayList<>();
        for (String markerKey : markerKeys) {
            BlockFloorMarkerEntity entity = new BlockFloorMarkerEntity();
            entity.setId(UUID.randomUUID());
            entity.setBlockId(blockId);
            entity.setMarkerKey(markerKey);
            entity.setMarkerType(resolveMarkerType(markerKey));
            entity.setFloorIndex(resolveFloorIndex(markerKey));
            entity.setIsTechnical(technicalKeys.contains(markerKey));
            entity.setIsCommercial(commercialKeys.contains(markerKey));
            entity.setCreatedAt(now);
            entity.setUpdatedAt(now);
            markers.add(entity);
        }

        blockFloorMarkerJpaRepository.saveAll(markers);
    }

    private String resolveMarkerType(String markerKey) {
        if (markerKey.startsWith("basement_")) {
            return "basement";
        }
        if (markerKey.endsWith(TECHNICAL_SUFFIX)) {
            return "technical";
        }
        if (Set.of("attic", "loft", "roof", "tsokol").contains(markerKey)) {
            return "special";
        }
        return "floor";
    }

    private Integer resolveFloorIndex(String markerKey) {
        if (markerKey.endsWith(TECHNICAL_SUFFIX)) {
            return toNullableInt(markerKey.replace(TECHNICAL_SUFFIX, ""));
        }
        if (markerKey.matches("^-?\\d+$")) {
            return Integer.parseInt(markerKey);
        }
        return null;
    }

    private Integer toNullableInt(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        String raw = String.valueOf(value).trim();
        if (raw.isBlank()) {
            return null;
        }
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
