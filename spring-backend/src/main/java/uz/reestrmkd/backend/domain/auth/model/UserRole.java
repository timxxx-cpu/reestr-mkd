package uz.reestrmkd.backend.domain.auth.model;

import java.util.Arrays;
import java.util.Locale;
import java.util.Optional;

public enum UserRole {
    ADMIN(99L, "admin"),
    TECHNICIAN(100L, "technician"),
    CONTROLLER(101L, "controller"),
    BRANCH_MANAGER(102L, "branch_manager");

    private final long id;
    private final String key;

    UserRole(long id, String key) {
        this.id = id;
        this.key = key;
    }

    public long id() {
        return id;
    }

    public String key() {
        return key;
    }

    public static Optional<UserRole> fromId(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        return Arrays.stream(values()).filter(role -> role.id == id).findFirst();
    }

    public static Optional<UserRole> fromKey(String key) {
        if (key == null || key.isBlank()) {
            return Optional.empty();
        }
        String normalized = key.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values()).filter(role -> role.key.equals(normalized)).findFirst();
    }
}
