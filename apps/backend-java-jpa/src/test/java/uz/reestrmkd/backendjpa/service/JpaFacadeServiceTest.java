package uz.reestrmkd.backendjpa.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import uz.reestrmkd.backendjpa.domain.ProjectEntity;
import uz.reestrmkd.backendjpa.repo.ApplicationRepository;
import uz.reestrmkd.backendjpa.repo.ProjectRepository;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JpaFacadeServiceTest {

    @Mock
    private ApplicationRepository applications;

    @Mock
    private ProjectRepository projects;

    @InjectMocks
    private JpaFacadeService service;

    @Test
    void setProjectIntegration_setsStatusIntoIntegrationData_andPreservesExistingKeys() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p-1");
        Map<String, Object> existing = new HashMap<>();
        existing.put("attempt", 2);
        existing.put("provider", "epigu");
        project.setIntegrationData(existing);

        when(projects.findById("p-1")).thenReturn(Optional.of(project));

        Map<String, Object> response = service.setProjectIntegration("p-1", "SYNCED");

        assertEquals(true, response.get("ok"));
        assertEquals("SYNCED", project.getIntegrationData().get("status"));
        assertEquals(2, project.getIntegrationData().get("attempt"));
        assertEquals("epigu", project.getIntegrationData().get("provider"));

        ArgumentCaptor<ProjectEntity> captor = ArgumentCaptor.forClass(ProjectEntity.class);
        verify(projects).save(captor.capture());
        assertTrue(captor.getValue().getIntegrationData().containsKey("status"));
    }

    @Test
    void setProjectIntegration_initializesIntegrationData_whenNull() {
        ProjectEntity project = new ProjectEntity();
        project.setId("p-2");
        project.setIntegrationData(null);

        when(projects.findById("p-2")).thenReturn(Optional.of(project));

        service.setProjectIntegration("p-2", "FAILED");

        assertEquals("FAILED", project.getIntegrationData().get("status"));
        verify(projects).save(project);
    }
}
