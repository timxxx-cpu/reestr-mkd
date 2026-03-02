package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.BlockEngineeringEntity;
public interface BlockEngineeringRepository extends JpaRepository<BlockEngineeringEntity, String> {
java.util.Optional<uz.reestrmkd.backendjpa.domain.BlockEngineeringEntity> findByBlockId(String blockId);
}