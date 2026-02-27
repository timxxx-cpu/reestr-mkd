package uz.reestrmkd.backendjpa.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backendjpa.repo.ApplicationRepository;
import uz.reestrmkd.backendjpa.repo.ProjectRepository;

import java.util.Map;

@Service
public class ProjectJpaService {
    private final ProjectRepository projects;
    private final ApplicationRepository applications;

    public ProjectJpaService(ProjectRepository projects, ApplicationRepository applications) {
        this.projects = projects;
        this.applications = applications;
    }

    public Map<String, Object> list(String scope) {
        var items = scope == null ? projects.findAll() : projects.findByScopeIdOrderByIdDesc(scope);
        return Map.of("items", items, "total", items.size());
    }

    public Map<String, Object> appId(String projectId, String scope) {
        var row = applications.findFirstByProjectIdAndScopeId(projectId, scope).orElse(null);
        return Map.of("applicationId", row == null ? null : row.getId());
    }

    @Transactional
    public Map<String, Object> integrationStatus(String projectId, String status) {
        var p = projects.findById(projectId).orElseThrow();
        p.setIntegrationStatus(status);
        projects.save(p);
        return Map.of("ok", true);
    }
}
