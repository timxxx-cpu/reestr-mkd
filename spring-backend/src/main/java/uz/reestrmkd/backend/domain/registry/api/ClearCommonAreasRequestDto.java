package uz.reestrmkd.backend.domain.registry.api;

public record ClearCommonAreasRequestDto(
    String floorIds
) {
    public String safeFloorIds() {
        return floorIds == null ? "" : floorIds;
    }
}
