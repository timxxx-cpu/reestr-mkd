package uz.reestrmkd.backend.domain.common.api;

import java.util.List;

public record PagedItemsResponseDto(
    List<?> items,
    int page,
    int limit,
    int total,
    int totalPages
) {}
