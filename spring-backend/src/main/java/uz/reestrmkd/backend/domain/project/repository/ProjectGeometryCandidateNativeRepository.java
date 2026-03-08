package uz.reestrmkd.backend.domain.project.repository;

import java.util.UUID;

public interface ProjectGeometryCandidateNativeRepository {

    boolean upsertGeometryCandidate(
        UUID projectId,
        Integer sourceIndex,
        String label,
        String propertiesJson,
        String geometryJson
    );
}
