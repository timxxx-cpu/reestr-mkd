package uz.reestrmkd.backend.domain.registry.api;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import uz.reestrmkd.backend.domain.registry.service.UpdateExtensionCommand;

import java.util.HashMap;
import java.util.Map;

public record UpdateExtensionRequestDto(
    @Size(max = 255, message = "label length must be <= 255")
    String label,
    @Min(value = 1, message = "floorsCount must be >= 1")
    Integer floorsCount,
    @Min(value = 1, message = "startFloorIndex must be >= 1")
    Integer startFloorIndex
) {
    public UpdateExtensionCommand toCommand() {
        return new UpdateExtensionCommand(label, floorsCount, startFloorIndex);
    }

    public Map<String, Object> toMap() {
        Map<String, Object> out = new HashMap<>();
        if (label != null) out.put("label", label);
        if (floorsCount != null) out.put("floorsCount", floorsCount);
        if (startFloorIndex != null) out.put("startFloorIndex", startFloorIndex);
        return out;
    }
}
