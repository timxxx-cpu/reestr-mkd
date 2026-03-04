package uz.reestr.mkd.backendjpa.config;

import java.nio.file.Path;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class StorageWebMvcConfig implements WebMvcConfigurer {

  private final String uploadDir;

  public StorageWebMvcConfig(@Value("${app.storage.upload-dir:uploads}") String uploadDir) {
    this.uploadDir = uploadDir;
  }

  @Override
  public void addResourceHandlers(ResourceHandlerRegistry registry) {
    String absolute = Path.of(uploadDir).toAbsolutePath().normalize().toUri().toString();
    registry.addResourceHandler("/uploads/**")
        .addResourceLocations(absolute);
  }
}
