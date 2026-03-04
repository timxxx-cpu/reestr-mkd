package uz.reestrmkd.backend.enums;

import java.util.Arrays;

public enum UnitType {
    FLAT("flat"),
    OFFICE("office"),
    DUPLEX_UP("duplex_up"),
    DUPLEX_DOWN("duplex_down"),
    PANTRY("pantry");

    private final String value;

    UnitType(String value) {
        this.value = value;
    }

    public String value() {
        return value;
    }

    public static UnitType fromValue(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Unit type is required");
        }
        return Arrays.stream(values())
            .filter(type -> type.value.equals(value))
            .findFirst()
            .orElseThrow(() -> new IllegalArgumentException("Unsupported unit type: " + value));
    }
}
