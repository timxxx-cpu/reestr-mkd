package uz.reestrmkd.backend.domain.registry.service;

public record UpdateExtensionCommand(
    String label,
    Integer floorsCount,
    Integer startFloorIndex
) {
}
