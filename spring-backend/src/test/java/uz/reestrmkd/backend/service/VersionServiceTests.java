package uz.reestrmkd.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backend.domain.registry.model.ObjectVersionEntity;
import uz.reestrmkd.backend.domain.registry.repository.ObjectVersionJpaRepository;
import uz.reestrmkd.backend.domain.registry.service.VersionService;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VersionServiceTests {

    @Mock
    private ObjectVersionJpaRepository objectVersionJpaRepository;

    @Test
    void shouldReturnFilteredVersionsInLegacyApiShape() {
        VersionService service = service();
        UUID entityId = UUID.randomUUID();
        ObjectVersionEntity version = version(5L, entityId, "PENDING");
        version.setVersionNumber(3);

        when(objectVersionJpaRepository.findByEntityTypeAndEntityIdOrderByVersionNumberDesc("project", entityId))
            .thenReturn(List.of(version));

        List<Map<String, Object>> result = service.getVersions("project", entityId);

        assertThat(result).singleElement().satisfies(item -> {
            assertThat(item).containsEntry("id", 5L);
            assertThat(item).containsEntry("entity_type", "project");
            assertThat(item).containsEntry("entity_id", entityId);
            assertThat(item).containsEntry("version_number", 3);
            assertThat(item).containsEntry("version_status", "PENDING");
        });
    }

    @Test
    void shouldReturnLatestVersionsWhenFilterIsMissing() {
        VersionService service = service();
        UUID entityId = UUID.randomUUID();

        when(objectVersionJpaRepository.findTop100ByOrderByUpdatedAtDesc())
            .thenReturn(List.of(version(8L, entityId, "CURRENT")));

        List<Map<String, Object>> result = service.getVersions(null, entityId);

        verify(objectVersionJpaRepository).findTop100ByOrderByUpdatedAtDesc();
        assertThat(result).hasSize(1);
        assertThat(result.getFirst()).containsEntry("id", 8L);
    }

    @Test
    void shouldReturnSnapshotDataByVersionId() {
        VersionService service = service();
        ObjectVersionEntity version = version(12L, UUID.randomUUID(), "CURRENT");
        version.setSnapshotData(Map.of("name", "Snapshot A"));
        when(objectVersionJpaRepository.findById(12L)).thenReturn(Optional.of(version));

        Map<String, Object> result = service.getSnapshot(12L);

        assertThat(result).containsEntry("snapshot_data", Map.of("name", "Snapshot A"));
    }

    @Test
    void shouldUpdateVersionStatusesViaJpa() {
        VersionService service = service();
        ObjectVersionEntity current = version(21L, UUID.randomUUID(), "PENDING");
        ObjectVersionEntity declined = version(22L, UUID.randomUUID(), "PENDING");
        ObjectVersionEntity restored = version(23L, UUID.randomUUID(), "DECLINED");

        when(objectVersionJpaRepository.findById(21L)).thenReturn(Optional.of(current));
        when(objectVersionJpaRepository.findById(22L)).thenReturn(Optional.of(declined));
        when(objectVersionJpaRepository.findById(23L)).thenReturn(Optional.of(restored));
        when(objectVersionJpaRepository.save(any(ObjectVersionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.approveVersion(21L);
        service.declineVersion(22L);
        service.restoreVersion(23L);

        ArgumentCaptor<ObjectVersionEntity> captor = ArgumentCaptor.forClass(ObjectVersionEntity.class);
        verify(objectVersionJpaRepository, org.mockito.Mockito.times(3)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(ObjectVersionEntity::getVersionStatus)
            .containsExactly("CURRENT", "DECLINED", "CURRENT");
        assertThat(captor.getAllValues()).allSatisfy(item -> assertThat(item.getUpdatedAt()).isNotNull());
    }

    private VersionService service() {
        return new VersionService(
            false,
            new ObjectMapper(),
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            objectVersionJpaRepository
        );
    }

    private ObjectVersionEntity version(Long id, UUID entityId, String status) {
        ObjectVersionEntity entity = new ObjectVersionEntity();
        entity.setId(id);
        entity.setEntityType("project");
        entity.setEntityId(entityId);
        entity.setVersionNumber(1);
        entity.setVersionStatus(status);
        entity.setCreatedBy("tester");
        entity.setApplicationId(UUID.randomUUID());
        entity.setUpdatedAt(Instant.parse("2026-03-07T00:00:00Z"));
        return entity;
    }
}
