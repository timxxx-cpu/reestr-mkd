package uz.reestrmkd.backend.dto;

import java.util.List;
import java.util.UUID;

public record ValidationStepResponseDto(
    boolean ok,
    UUID projectId,
    String scope,
    String stepId,
    List<ValidationErrorItemDto> errors
) {}
