package uz.reestrmkd.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String authMode = "dev";
    private String jwtSecret = "";
    private String runtimeEnv = "dev";
    private String corsOrigin = "";
    private final Idempotency idempotency = new Idempotency();

    public static class Idempotency {
        private long ttlMs = 300000;
        private int maxEntries = 2000;
        public long getTtlMs() { return ttlMs; }
        public void setTtlMs(long ttlMs) { this.ttlMs = ttlMs; }
        public int getMaxEntries() { return maxEntries; }
        public void setMaxEntries(int maxEntries) { this.maxEntries = maxEntries; }
    }

    public String getAuthMode() { return authMode; }
    public void setAuthMode(String authMode) { this.authMode = authMode; }
    public String getJwtSecret() { return jwtSecret; }
    public void setJwtSecret(String jwtSecret) { this.jwtSecret = jwtSecret; }
    public String getRuntimeEnv() { return runtimeEnv; }
    public void setRuntimeEnv(String runtimeEnv) { this.runtimeEnv = runtimeEnv; }
    public String getCorsOrigin() { return corsOrigin; }
    public void setCorsOrigin(String corsOrigin) { this.corsOrigin = corsOrigin; }
    public Idempotency getIdempotency() { return idempotency; }
}
