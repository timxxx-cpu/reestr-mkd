package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestrmkd.backendjpa.domain.ProjectGeometryCandidateEntity;

import java.util.List;
import java.util.Optional;

public interface ProjectGeometryCandidateRepository extends JpaRepository<ProjectGeometryCandidateEntity, String> {
    List<ProjectGeometryCandidateEntity> findByProjectIdOrderBySourceIndexAsc(String projectId);

    Optional<ProjectGeometryCandidateEntity> findByIdAndProjectId(String id, String projectId);

    long deleteByIdAndProjectId(String id, String projectId);

    @Modifying
    @Query("update ProjectGeometryCandidateEntity c set c.isSelectedLandPlot = :selected where c.projectId = :projectId")
    int updateIsSelectedLandPlotByProjectId(@Param("projectId") String projectId, @Param("selected") Boolean selected);

    @Modifying
    @Query("update ProjectGeometryCandidateEntity c set c.isSelectedLandPlot = :selected where c.id = :id and c.projectId = :projectId")
    int updateIsSelectedLandPlotByIdAndProjectId(@Param("id") String id, @Param("projectId") String projectId, @Param("selected") Boolean selected);

    @Modifying
    @Query("update ProjectGeometryCandidateEntity c set c.assignedBuildingId = :buildingId where c.id = :id and c.projectId = :projectId")
    int updateAssignedBuildingByIdAndProjectId(@Param("id") String id, @Param("projectId") String projectId, @Param("buildingId") String buildingId);

    @Modifying
    @Query("update ProjectGeometryCandidateEntity c set c.assignedBuildingId = null where c.projectId = :projectId and c.assignedBuildingId = :buildingId")
    int clearAssignedBuildingByProjectIdAndBuildingId(@Param("projectId") String projectId, @Param("buildingId") String buildingId);
}
