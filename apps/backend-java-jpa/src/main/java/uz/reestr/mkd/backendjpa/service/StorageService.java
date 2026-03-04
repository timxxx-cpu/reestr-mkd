package uz.reestr.mkd.backendjpa.service;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class StorageService {

  private final Path uploadRoot;
  private final String publicBaseUrl;

  public StorageService(
      @Value("${app.storage.upload-dir:uploads}") String uploadDir,
      @Value("${app.storage.public-base-url:/uploads}") String publicBaseUrl
  ) {
    this.uploadRoot = Path.of(uploadDir).toAbsolutePath().normalize();
    this.publicBaseUrl = normalizeBaseUrl(publicBaseUrl);
    try {
      Files.createDirectories(this.uploadRoot);
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to initialize upload storage", e);
    }
  }

  public String store(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "file is required");
    }

    String originalName = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
    String safeName = sanitizeFileName(originalName);
    String storedName = UUID.randomUUID() + "-" + safeName;
    Path destination = uploadRoot.resolve(storedName).normalize();

    if (!destination.startsWith(uploadRoot)) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid file name");
    }

    try (InputStream in = file.getInputStream()) {
      Files.copy(in, destination, StandardCopyOption.REPLACE_EXISTING);
    } catch (IOException e) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Unable to store uploaded file", e);
    }

    return publicBaseUrl + "/" + storedName;
  }

  private String sanitizeFileName(String fileName) {
    String normalized = Path.of(fileName).getFileName().toString();
    String safe = normalized.replaceAll("[^a-zA-Z0-9._-]", "_");
    return safe.isBlank() ? "file" : safe;
  }

  private String normalizeBaseUrl(String value) {
    if (value == null || value.isBlank()) {
      return "/uploads";
    }
    String trimmed = value.trim();
    if (!trimmed.startsWith("/")) {
      trimmed = "/" + trimmed;
    }
    return trimmed.endsWith("/") ? trimmed.substring(0, trimmed.length() - 1) : trimmed;
  }
}
