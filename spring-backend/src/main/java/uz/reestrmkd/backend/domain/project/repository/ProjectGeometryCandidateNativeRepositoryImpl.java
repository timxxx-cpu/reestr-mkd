package uz.reestrmkd.backend.domain.project.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public class ProjectGeometryCandidateNativeRepositoryImpl implements ProjectGeometryCandidateNativeRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public boolean upsertGeometryCandidate(
        UUID projectId,
        Integer sourceIndex,
        String label,
        String propertiesJson,
        String geometryJson
    ) {
        @SuppressWarnings("unchecked")
        List<Object> rows = entityManager.createNativeQuery(
            """
            insert into project_geometry_candidates(
                project_id, source_index, label, properties, geom_geojson, geom, area_m2, updated_at
            ) values (
                :projectId, :sourceIndex, :label, cast(:properties as jsonb), cast(:geometry as jsonb),
                st_multi(st_setsrid(st_geomfromgeojson(cast(:geometry as text)), 3857)),
                round(st_area(st_multi(st_setsrid(st_geomfromgeojson(cast(:geometry as text)), 3857)))::numeric, 2),
                now()
            )
            on conflict (project_id, source_index) do update set
                label = excluded.label,
                properties = excluded.properties,
                geom_geojson = excluded.geom_geojson,
                geom = excluded.geom,
                area_m2 = excluded.area_m2,
                updated_at = now()
            returning id
            """
        )
            .setParameter("projectId", projectId)
            .setParameter("sourceIndex", sourceIndex)
            .setParameter("label", label)
            .setParameter("properties", propertiesJson)
            .setParameter("geometry", geometryJson)
            .getResultList();

        return !rows.isEmpty();
    }
}
