package uz.reestrmkd.backend.domain.registry.api;

import java.util.List;

public record GeometryCandidatesImportRequestDto(
    List<GeometryCandidateImportItemDto> candidates
) {
}
