package uz.reestrmkd.backend.security;

public record AuthContext(String userId, String userRole, String authType) {}
