package uz.reestrmkd.backendjpa.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import uz.reestrmkd.backendjpa.repo.ApplicationRepository;
import uz.reestrmkd.backendjpa.repo.ProjectRepository;

import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class JpaFacadeService {
    private final ApplicationRepository applications;
    private final ProjectRepository projects;
    @PersistenceContext
    private EntityManager em;

    @Transactional(readOnly = true)
    public Object nativeList(String table, String whereField, Object whereVal) {
        String sql = "select * from " + table + (whereField == null ? "" : (" where " + whereField + " = :v"));
        var q = em.createNativeQuery(sql, Map.class);
        if (whereField != null) q.setParameter("v", whereVal);
        return q.getResultList();
    }

    public Map<String, Object> ok() { return Map.of("ok", true); }

    @Transactional
    public Map<String, Object> updateApplicationWorkflow(String applicationId, String status, String substatus) {
        var app = applications.findById(applicationId).orElseThrow();
        app.setStatus(status);
        app.setWorkflowSubstatus(substatus);
        applications.save(app);
        return Map.of("ok", true, "applicationId", applicationId, "status", status, "workflowSubstatus", substatus);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> summary(String scope) {
        var apps = scope == null ? applications.findAll() : applications.findByScopeIdOrderByIdDesc(scope);
        return Map.of("total", apps.size());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> projects(String scope) {
        var list = scope == null ? projects.findAll() : projects.findByScopeIdOrderByIdDesc(scope);
        return Map.of("items", list, "total", list.size());
    }

    @Transactional
    public Map<String, Object> setProjectIntegration(String projectId, String status) {
        var p = projects.findById(projectId).orElseThrow();
        Map<String, Object> integration = p.getIntegrationData() == null
            ? new HashMap<>()
            : new HashMap<>(p.getIntegrationData());
        integration.put("status", status);
        p.setIntegrationData(integration);
        projects.save(p);
        return Map.of("ok", true);
    }
}
