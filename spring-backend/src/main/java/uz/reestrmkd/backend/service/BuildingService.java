package uz.reestrmkd.backend.service;

import jakarta.transaction.Transactional;
import org.springframework.stereotype.Service;
import uz.reestrmkd.backend.entity.BuildingBlockEntity;
import uz.reestrmkd.backend.exception.ApiException;
import uz.reestrmkd.backend.repository.BuildingBlockJpaRepository;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class BuildingService {

    private final BuildingBlockJpaRepository blockRepo;

    public BuildingService(BuildingBlockJpaRepository blockRepo) {
        this.blockRepo = blockRepo;
    }

    @Transactional
    public void mergeBlockDetails(UUID blockId, Map<String, Object> details) {
        BuildingBlockEntity block = blockRepo.findById(blockId)
            .orElseThrow(() -> new ApiException("Building block not found", "NOT_FOUND", null, 404));

        mergeInt(details.get("floorsFrom"), block::setFloorsFrom);
        mergeInt(details.get("floorsTo"), block::setFloorsTo);
        mergeInt(details.get("floorsCount"), block::setFloorsCount);
        mergeInt(details.get("entrancesCount"), block::setEntrancesCount);
        mergeBool(details.get("hasBasement"), block::setHasBasement);
        mergeBool(details.get("hasAttic"), block::setHasAttic);
        mergeBool(details.get("hasLoft"), block::setHasLoft);
        mergeBool(details.get("hasRoofExpl"), block::setHasRoofExpl);

        block.setUpdatedAt(Instant.now());
        blockRepo.save(block);
    }

    private void mergeInt(Object value, java.util.function.Consumer<Integer> setter) {
        Integer parsed = toNullableInt(value);
        if (parsed != null) setter.accept(parsed);
    }

    private void mergeBool(Object value, java.util.function.Consumer<Boolean> setter) {
        Boolean parsed = toNullableBool(value);
        if (parsed != null) setter.accept(parsed);
    }

    private Integer toNullableInt(Object value) {
        if (value == null) return null;
        if (value instanceof Number n) return n.intValue();
        String s = String.valueOf(value);
        if (s.isBlank()) return null;
        return Integer.parseInt(s);
    }

    private Boolean toNullableBool(Object value) {
        if (value == null) return null;
        if (value instanceof Boolean b) return b;
        String s = String.valueOf(value);
        if (s.isBlank()) return null;
        return Boolean.parseBoolean(s);
    }
}
