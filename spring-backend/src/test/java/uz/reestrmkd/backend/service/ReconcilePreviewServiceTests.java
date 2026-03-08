package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.CommonAreaEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceEntity;
import uz.reestrmkd.backend.domain.registry.model.EntranceMatrixEntity;
import uz.reestrmkd.backend.domain.registry.model.FloorEntity;
import uz.reestrmkd.backend.domain.registry.model.UnitEntity;
import uz.reestrmkd.backend.domain.registry.repository.CommonAreaJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.EntranceMatrixJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.FloorJpaRepository;
import uz.reestrmkd.backend.domain.registry.repository.UnitJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.ReconcilePreviewService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ReconcilePreviewServiceTests {

    @Mock
    private FloorJpaRepository floorJpaRepository;
    @Mock
    private EntranceJpaRepository entranceJpaRepository;
    @Mock
    private EntranceMatrixJpaRepository entranceMatrixJpaRepository;
    @Mock
    private UnitJpaRepository unitJpaRepository;
    @Mock
    private CommonAreaJpaRepository commonAreaJpaRepository;

    @InjectMocks
    private ReconcilePreviewService service;

    @Test
    void shouldReturnZeroPreviewWhenNoFloors() {
        UUID blockId = UUID.randomUUID();
        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of());

        Map<String, Object> result = service.preview(blockId);

        @SuppressWarnings("unchecked")
        Map<String, Object> units = (Map<String, Object>) result.get("units");
        @SuppressWarnings("unchecked")
        Map<String, Object> common = (Map<String, Object>) result.get("commonAreas");
        assertThat(units).containsEntry("toRemove", 0).containsEntry("checkedCells", 0);
        assertThat(common).containsEntry("toRemove", 0).containsEntry("checkedCells", 0);
    }

    @Test
    void shouldCalculateUnitsAndCommonAreasToRemove() {
        UUID blockId = UUID.randomUUID();
        UUID floorId = UUID.randomUUID();
        UUID entranceId = UUID.randomUUID();

        when(floorJpaRepository.findByBlockIdOrderByIndexAsc(blockId)).thenReturn(List.of(floor(floorId)));
        when(entranceJpaRepository.findByBlockIdOrderByNumberAsc(blockId)).thenReturn(List.of(entrance(entranceId, 1)));
        when(entranceMatrixJpaRepository.findByBlockIdOrderByEntranceNumberAsc(blockId))
            .thenReturn(List.of(matrix(floorId, 1, 1, 0, 1)));
        when(unitJpaRepository.findByFloorIdIn(List.of(floorId)))
            .thenReturn(List.of(
                unit(floorId, entranceId, "flat"),
                unit(floorId, entranceId, "flat")
            ));
        when(commonAreaJpaRepository.findByFloorIdIn(List.of(floorId)))
            .thenReturn(List.of(
                area(floorId, entranceId),
                area(floorId, entranceId)
            ));

        Map<String, Object> result = service.preview(blockId);

        @SuppressWarnings("unchecked")
        Map<String, Object> units = (Map<String, Object>) result.get("units");
        @SuppressWarnings("unchecked")
        Map<String, Object> common = (Map<String, Object>) result.get("commonAreas");

        assertThat(units).containsEntry("toRemove", 1).containsEntry("checkedCells", 1);
        assertThat(common).containsEntry("toRemove", 1).containsEntry("checkedCells", 1);
    }

    private FloorEntity floor(UUID id) {
        FloorEntity entity = new FloorEntity();
        entity.setId(id);
        return entity;
    }

    private EntranceEntity entrance(UUID id, int number) {
        EntranceEntity entity = new EntranceEntity();
        entity.setId(id);
        entity.setNumber(number);
        return entity;
    }

    private EntranceMatrixEntity matrix(UUID floorId, int entranceNumber, int flatsCount, int commercialCount, int mopCount) {
        EntranceMatrixEntity entity = new EntranceMatrixEntity();
        entity.setFloorId(floorId);
        entity.setEntranceNumber(entranceNumber);
        entity.setFlatsCount(flatsCount);
        entity.setCommercialCount(commercialCount);
        entity.setMopCount(mopCount);
        return entity;
    }

    private UnitEntity unit(UUID floorId, UUID entranceId, String unitType) {
        UnitEntity entity = new UnitEntity();
        entity.setId(UUID.randomUUID());
        entity.setFloorId(floorId);
        entity.setEntranceId(entranceId);
        entity.setUnitType(unitType);
        return entity;
    }

    private CommonAreaEntity area(UUID floorId, UUID entranceId) {
        CommonAreaEntity entity = new CommonAreaEntity();
        entity.setId(UUID.randomUUID());
        entity.setFloorId(floorId);
        entity.setEntranceId(entranceId);
        return entity;
    }
}
