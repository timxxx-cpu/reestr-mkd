package uz.reestrmkd.backend.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

public record ProjectContextResponseDto(
    @JsonProperty("project") ProjectDbDto project,
    @JsonProperty("application") ApplicationDbDto application,
    @JsonProperty("participants") List<ProjectParticipantDbDto> participants,
    @JsonProperty("documents") List<ProjectDocumentDbDto> documents,
    @JsonProperty("buildings") List<BuildingDbDto> buildings,
    @JsonProperty("history") List<ApplicationHistoryDbDto> history,
    @JsonProperty("steps") List<ApplicationStepDbDto> steps,
    @JsonProperty("block_floor_markers") List<BlockFloorMarkerDbDto> blockFloorMarkers,
    @JsonProperty("block_extensions") List<BlockExtensionDbDto> blockExtensions
) {
}
