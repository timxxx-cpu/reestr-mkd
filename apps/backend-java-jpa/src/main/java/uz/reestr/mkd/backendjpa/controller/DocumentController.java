package uz.reestr.mkd.backendjpa.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import uz.reestr.mkd.backendjpa.service.StorageService;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

  private final StorageService storageService;

  public DocumentController(StorageService storageService) {
    this.storageService = storageService;
  }

  @PostMapping("/upload")
  public ResponseEntity<UploadDocumentResponse> upload(@RequestParam("file") MultipartFile file) {
    String url = storageService.store(file);
    return ResponseEntity.ok(new UploadDocumentResponse(url));
  }

  public record UploadDocumentResponse(String url) {
  }
}
