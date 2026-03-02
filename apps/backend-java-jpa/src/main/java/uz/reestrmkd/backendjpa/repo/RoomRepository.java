// RoomRepository.java
package uz.reestrmkd.backendjpa.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.RoomEntity;
public interface RoomRepository extends JpaRepository<RoomEntity, String> {}