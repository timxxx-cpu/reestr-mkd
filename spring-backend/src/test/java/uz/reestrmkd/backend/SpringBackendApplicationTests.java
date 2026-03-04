package uz.reestrmkd.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "app.supabase-url=https://example.supabase.co",
    "app.supabase-service-role-key=test-service-role-key",
    "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration",
    "spring.main.lazy-initialization=true"
})
class SpringBackendApplicationTests {

    @Test
    void contextLoads() {
    }
}
