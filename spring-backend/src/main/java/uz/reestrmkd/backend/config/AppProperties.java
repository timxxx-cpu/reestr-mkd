package uz.reestrmkd.backend.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Set;

@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private static final Set<String> FORBIDDEN_DEV_AUTH_ENVS = Set.of("production", "prod", "preprod", "staging");

    private String runtimeEnv = "dev";
    private String authMode = "dev";
    private String jwtSecret = "";
    private String supabaseUrl;
    private String supabaseServiceRoleKey;
    private Cors cors = new Cors();

    @PostConstruct
    public void validate() {
        runtimeEnv = safeLower(runtimeEnv);
        authMode = safeLower(authMode);

        if (supabaseUrl == null || supabaseUrl.isBlank() || supabaseServiceRoleKey == null || supabaseServiceRoleKey.isBlank()) {
            throw new IllegalStateException("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
        }

        if (jwtSecret == null || jwtSecret.isBlank()) {
            throw new IllegalStateException("Missing JWT_SECRET");
        }

        if ("dev".equals(authMode) && FORBIDDEN_DEV_AUTH_ENVS.contains(runtimeEnv)) {
            throw new IllegalStateException("AUTH_MODE=dev is forbidden for runtime env: " + runtimeEnv);
        }
    }

    private String safeLower(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    public String getRuntimeEnv() {
        return runtimeEnv;
    }

    public void setRuntimeEnv(String runtimeEnv) {
        this.runtimeEnv = runtimeEnv;
    }

    public String getAuthMode() {
        return authMode;
    }

    public void setAuthMode(String authMode) {
        this.authMode = authMode;
    }

    public String getJwtSecret() {
        return jwtSecret;
    }

    public void setJwtSecret(String jwtSecret) {
        this.jwtSecret = jwtSecret;
    }

    public String getSupabaseUrl() {
        return supabaseUrl;
    }

    public void setSupabaseUrl(String supabaseUrl) {
        this.supabaseUrl = supabaseUrl;
    }

    public String getSupabaseServiceRoleKey() {
        return supabaseServiceRoleKey;
    }

    public void setSupabaseServiceRoleKey(String supabaseServiceRoleKey) {
        this.supabaseServiceRoleKey = supabaseServiceRoleKey;
    }

    public Cors getCors() {
        return cors;
    }

    public void setCors(Cors cors) {
        this.cors = cors;
    }

    public static class Cors {
        private String origin = "";

        public String getOrigin() {
            return origin;
        }

        public void setOrigin(String origin) {
            this.origin = origin;
        }
    }
}
