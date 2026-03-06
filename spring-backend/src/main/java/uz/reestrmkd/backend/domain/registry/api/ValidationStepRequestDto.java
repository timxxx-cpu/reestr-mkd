package uz.reestrmkd.backend.domain.registry.api;

public record ValidationStepRequestDto(
    String scope,
    String stepId
) {}
