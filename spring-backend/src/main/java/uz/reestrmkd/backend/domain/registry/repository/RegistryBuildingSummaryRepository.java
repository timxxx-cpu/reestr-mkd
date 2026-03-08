package uz.reestrmkd.backend.domain.registry.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import uz.reestrmkd.backend.domain.registry.model.RegistryBuildingSummaryView;

import java.util.UUID;

public interface RegistryBuildingSummaryRepository extends JpaRepository<RegistryBuildingSummaryView, UUID> {

    @Query("""
        select v
        from RegistryBuildingSummaryView v
        where :search is null
           or lower(coalesce(v.projectName, '')) like lower(concat('%', :search, '%'))
           or lower(coalesce(v.buildingName, '')) like lower(concat('%', :search, '%'))
           or lower(coalesce(v.blockLabel, '')) like lower(concat('%', :search, '%'))
        order by v.projectName asc
    """)
    Page<RegistryBuildingSummaryView> findSummary(@Param("search") String search, Pageable pageable);
}
