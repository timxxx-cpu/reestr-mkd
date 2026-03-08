package uz.reestrmkd.backend.domain.auth.api;

public record LoginUserDto(
    String id,
    String name,
    Long roleId,
    String role
) {
    public LoginUserDto(String id, String name, String role) {
        this(id, name, null, role);
    }
}
