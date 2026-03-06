package uz.reestrmkd.backend.domain.integration.model;

import java.util.Arrays;

public enum IntegrationStatus {
    IDLE,
    SENDING,
    WAITING,
    COMPLETED,
    ERROR;

    public static IntegrationStatus fromValue(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Integration status is required");
        }
        return Arrays.stream(values())
            .filter(status -> status.name().equals(value))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unsupported integration status: " + value));
    }
}
