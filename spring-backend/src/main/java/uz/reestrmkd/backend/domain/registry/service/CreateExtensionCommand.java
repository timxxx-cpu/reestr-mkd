package uz.reestrmkd.backend.domain.registry.service;

public record CreateExtensionCommand(
    String buildingId,
    String label,
    String extensionType,
    String constructionKind,
    Integer floorsCount,
    Integer startFloorIndex,
    String verticalAnchorType,
    String anchorFloorKey,
    String notes
) {
}
