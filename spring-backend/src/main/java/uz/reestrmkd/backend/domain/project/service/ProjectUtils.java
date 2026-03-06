package uz.reestrmkd.backend.domain.project.service;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public final class ProjectUtils {

    private ProjectUtils() {
    }

    public static List<String> parseCsvParam(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }

        String[] parts = value.split(",");
        List<String> result = new ArrayList<>();
        for (String part : parts) {
            String normalized = part == null ? "" : part.trim();
            if (!normalized.isBlank()) {
                result.add(normalized);
            }
        }
        return result;
    }

    public static String normalizeProjectStatusFromDb(String status) {
        if ("project".equals(status)) {
            return "Проектный";
        }
        if ("construction".equals(status)) {
            return "Строящийся";
        }
        if ("completed".equals(status)) {
            return "Сдан в эксплуатацию";
        }
        return (status == null || status.isBlank()) ? "Проектный" : status;
    }

    public static List<String> buildProjectAvailableActions(String actorRole, ProjectDto projectDto, String actorUserId) {
        ApplicationInfo app = projectDto != null && projectDto.applicationInfo() != null
            ? projectDto.applicationInfo()
            : new ApplicationInfo(null, null, null);

        String status = app.status();
        String substatus = app.workflowSubstatus();

        boolean isCompleted = "COMPLETED".equals(status);
        boolean isDeclined = "DECLINED".equals(status);
        boolean isPendingDecline = "PENDING_DECLINE".equals(substatus);

        Set<String> actions = new LinkedHashSet<>();
        actions.add("view");

        String role = actorRole == null ? "" : actorRole.toLowerCase(Locale.ROOT);
        boolean isAdmin = "admin".equals(role);
        boolean isBranchManager = "branch_manager".equals(role);
        boolean isTechnician = "technician".equals(role);
        boolean isController = "controller".equals(role);

        boolean isAssigned = app.assigneeName() == null || app.assigneeName().isBlank() || app.assigneeName().equals(actorUserId);

        if (!isCompleted && !isDeclined && (isAdmin || isBranchManager)) {
            actions.add("reassign");
        }
        if (isAdmin) {
            actions.add("delete");
        }
        if ((isAdmin || isBranchManager || isController) && !isCompleted) {
            actions.add("decline");
        }
        if (isPendingDecline && (isAdmin || isBranchManager)) {
            actions.add("return_from_decline");
        }

        boolean canTechnicianEdit = isTechnician
            && isAssigned
            && List.of("DRAFT", "REVISION", "RETURNED_BY_MANAGER", "INTEGRATION").contains(substatus);

        boolean canControllerEdit = isController && "REVIEW".equals(substatus);

        if (!isCompleted && !isDeclined && (canTechnicianEdit || canControllerEdit || isAdmin)) {
            actions.add("edit");
        }

        return new ArrayList<>(actions);
    }

    public record ProjectDto(ApplicationInfo applicationInfo) {
    }

    public record ApplicationInfo(String status, String workflowSubstatus, String assigneeName) {
    }
}
