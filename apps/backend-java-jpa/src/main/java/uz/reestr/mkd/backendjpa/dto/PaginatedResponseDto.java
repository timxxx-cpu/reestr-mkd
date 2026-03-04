package uz.reestr.mkd.backendjpa.dto;

import java.util.List;

public record PaginatedResponseDto<T>(
    List<T> data,
    long total,
    int page,
    int totalPages
) {
}
