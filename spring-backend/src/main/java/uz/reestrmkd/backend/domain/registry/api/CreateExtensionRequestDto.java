package uz.reestrmkd.backend.domain.registry.api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import uz.reestrmkd.backend.domain.registry.service.CreateExtensionCommand;

import java.util.HashMap;
import java.util.Map;

public record CreateExtensionRequestDto(
    @NotBlank(message = "buildingId is required")
    String buildingId,
    @Size(max = 255, message = "label length must be <= 255")
    String label,
    String extensionType,
    String constructionKind,
    @Min(value = 1, message = "floorsCount must be >= 1")
    Integer floorsCount,
    @Min(value = 1, message = "startFloorIndex must be >= 1")
    Integer startFloorIndex,
    String verticalAnchorType,
    String anchorFloorKey,
    String notes
) {
    public CreateExtensionCommand toCommand() {
        return new CreateExtensionCommand(
            buildingId,
            label,
            extensionType,
            constructionKind,
            floorsCount,
            startFloorIndex,
            verticalAnchorType,
            anchorFloorKey,
            notes
        );
    }

    public Map<String, Object> toMap() {
        Map<String, Object> out = new HashMap<>();
        if (buildingId != null) out.put("buildingId", buildingId);
        if (label != null) out.put("label", label);
        if (extensionType != null) out.put("extensionType", extensionType);
        if (constructionKind != null) out.put("constructionKind", constructionKind);
        if (floorsCount != null) out.put("floorsCount", floorsCount);
        if (startFloorIndex != null) out.put("startFloorIndex", startFloorIndex);
        if (verticalAnchorType != null) out.put("verticalAnchorType", verticalAnchorType);
        if (anchorFloorKey != null) out.put("anchorFloorKey", anchorFloorKey);
        if (notes != null) out.put("notes", notes);
        return out;
    }
}
