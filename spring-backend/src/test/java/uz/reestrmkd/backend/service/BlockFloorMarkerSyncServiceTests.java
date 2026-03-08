package uz.reestrmkd.backend.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.BlockFloorMarkerEntity;
import uz.reestrmkd.backend.domain.registry.repository.BlockFloorMarkerJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.BlockFloorMarkerSyncService;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class BlockFloorMarkerSyncServiceTests {

    @Mock
    private BlockFloorMarkerJpaRepository blockFloorMarkerJpaRepository;

    @Test
    void shouldReplaceMarkersForBlockViaJpa() {
        UUID blockId = UUID.randomUUID();
        BlockFloorMarkerSyncService service = new BlockFloorMarkerSyncService(blockFloorMarkerJpaRepository);

        service.sync(blockId, Map.of(
            "technicalFloors", List.of(2),
            "commercialFloors", List.of("1", "roof")
        ));

        verify(blockFloorMarkerJpaRepository).deleteByBlockId(blockId);
        ArgumentCaptor<List<BlockFloorMarkerEntity>> captor = blockFloorMarkersCaptor();
        verify(blockFloorMarkerJpaRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(3);
        assertThat(captor.getValue())
            .extracting(BlockFloorMarkerEntity::getMarkerType)
            .containsExactlyInAnyOrder("technical", "floor", "special");
        assertThat(captor.getValue())
            .filteredOn(BlockFloorMarkerEntity::getIsTechnical)
            .singleElement()
            .extracting(BlockFloorMarkerEntity::getFloorIndex)
            .isEqualTo(2);
        assertThat(captor.getValue())
            .filteredOn(BlockFloorMarkerEntity::getIsCommercial)
            .extracting(BlockFloorMarkerEntity::getMarkerKey)
            .containsExactlyInAnyOrder("1", "roof");
    }

    @Test
    void shouldOnlyDeleteWhenNoMarkersRemain() {
        UUID blockId = UUID.randomUUID();
        BlockFloorMarkerSyncService service = new BlockFloorMarkerSyncService(blockFloorMarkerJpaRepository);

        service.sync(blockId, Map.of());

        verify(blockFloorMarkerJpaRepository).deleteByBlockId(blockId);
    }

    @SuppressWarnings("unchecked")
    private ArgumentCaptor<List<BlockFloorMarkerEntity>> blockFloorMarkersCaptor() {
        return (ArgumentCaptor<List<BlockFloorMarkerEntity>>) (ArgumentCaptor<?>) ArgumentCaptor.forClass(List.class);
    }
}
