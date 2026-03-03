package uz.reestrmkd.backendjpa.repo;

import org.springframework.data.jpa.repository.JpaRepository;
import uz.reestrmkd.backendjpa.domain.ApplicationStepEntity;

import java.util.List;
import java.util.Optional;

public interface ApplicationStepRepository extends JpaRepository<ApplicationStepEntity, String> {
    // Этот метод позволит нам искать шаг по ID заявки и его номеру (индексу)
    Optional<ApplicationStepEntity> findByApplicationIdAndStepIndex(String applicationId, Integer stepIndex);

    List<ApplicationStepEntity> findByApplicationIdOrderByStepIndexAsc(String applicationId);
}
