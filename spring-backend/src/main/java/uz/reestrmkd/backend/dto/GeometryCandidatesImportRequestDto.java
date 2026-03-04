package uz.reestrmkd.backend.dto;

import java.util.List;

public record GeometryCandidatesImportRequestDto(
    List<GeometryCandidateImportItemDto> candidates
) {
}
