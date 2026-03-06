package uz.reestrmkd.backend.domain.project.api;

import com.fasterxml.jackson.annotation.JsonProperty;

import uz.reestrmkd.backend.domain.registry.api.BlockExtensionDbDto;
import uz.reestrmkd.backend.domain.registry.api.BlockFloorMarkerDbDto;
import uz.reestrmkd.backend.domain.registry.api.BuildingDbDto;
import uz.reestrmkd.backend.domain.workflow.api.ApplicationDbDto;
import uz.reestrmkd.backend.domain.workflow.api.ApplicationHistoryDbDto;
import uz.reestrmkd.backend.domain.workflow.api.ApplicationStepDbDto;

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
