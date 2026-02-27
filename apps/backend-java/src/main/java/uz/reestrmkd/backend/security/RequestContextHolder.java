package uz.reestrmkd.backend.security;

public final class RequestContextHolder {
    private static final ThreadLocal<AuthContext> AUTH = new ThreadLocal<>();

    private RequestContextHolder() {}

    public static void set(AuthContext context) { AUTH.set(context); }
    public static AuthContext get() { return AUTH.get(); }
    public static void clear() { AUTH.remove(); }
}
