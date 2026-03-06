package uz.reestrmkd.backend.domain.project.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Arrays;

public enum ProjectStatus {
    PROJECT("Проектный"),
    BUILDING("Строящийся"),
    READY("Готовый к вводу"),
    DONE("Введенный");

    private final String value;

    ProjectStatus(String value) {
        this.value = value;
    }

    @JsonValue
    public String value() {
        return value;
    }

    @JsonCreator
    public static ProjectStatus fromValue(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return Arrays.stream(values())
            .filter(status -> status.value.equals(value))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unsupported project status: " + value));
    }
}
