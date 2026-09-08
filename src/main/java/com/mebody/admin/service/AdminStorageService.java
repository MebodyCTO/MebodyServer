package com.mebody.admin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mebody.admin.dto.AdminStorageImageDto;
import com.mebody.admin.dto.AdminStorageUploadResponse;
import com.mebody.common.exception.ApiException;
import com.mebody.common.security.CurrentUserService;
import com.mebody.common.security.SupabaseProperties;
import com.mebody.user.domain.UserRole;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AdminStorageService {
  private static final String BUCKET = "images";

  private final CurrentUserService currentUserService;
  private final SupabaseProperties supabaseProperties;
  private final ObjectMapper objectMapper;
  private final HttpClient httpClient = HttpClient.newHttpClient();

  public AdminStorageService(CurrentUserService currentUserService, SupabaseProperties supabaseProperties, ObjectMapper objectMapper) {
    this.currentUserService = currentUserService;
    this.supabaseProperties = supabaseProperties;
    this.objectMapper = objectMapper;
  }

  public List<AdminStorageImageDto> listImages(String prefix) {
    requireAdmin();
    String normalizedPrefix = normalizePrefix(prefix);
    try {
      String body = objectMapper.writeValueAsString(Map.of(
          "prefix", normalizedPrefix,
          "limit", 100,
          "offset", 0,
          "sortBy", Map.of("column", "name", "order", "asc")
      ));
      HttpRequest request = baseRequest("/storage/v1/object/list/" + BUCKET)
          .POST(HttpRequest.BodyPublishers.ofString(body))
          .header("Content-Type", "application/json")
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      ensureSuccess(response);

      JsonNode root = objectMapper.readTree(response.body());
      List<AdminStorageImageDto> images = new ArrayList<>();
      if (root.isArray()) {
        for (JsonNode node : root) {
          String name = node.path("name").asText("");
          if (name.isBlank() || name.equals(".emptyFolderPlaceholder")) continue;
          String path = normalizedPrefix.isBlank() ? name : normalizedPrefix + "/" + name;
          Long size = node.has("metadata") && node.path("metadata").has("size") ? node.path("metadata").path("size").asLong() : null;
          images.add(new AdminStorageImageDto(
              name,
              path,
              publicUrl(path),
              node.path("updated_at").asText(null),
              size
          ));
        }
      }
      return images;
    } catch (IOException e) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "이미지 목록을 읽지 못했습니다.");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.BAD_GATEWAY, "이미지 목록 요청이 중단되었습니다.");
    }
  }

  public AdminStorageUploadResponse uploadImage(String path, MultipartFile file) {
    requireAdmin();
    return uploadImageInternal(path, file);
  }

  /**
   * 관리자 외 역할(판매자)도 이미지를 올려야 하는 곳에서 씁니다.
   * 허용 역할을 호출부가 명시하게 해서, 권한 검사를 빠뜨릴 수 없게 했습니다.
   */
  public AdminStorageUploadResponse uploadImageFor(String path, MultipartFile file, UserRole... allowedRoles) {
    currentUserService.requireRole(allowedRoles);
    return uploadImageInternal(path, file);
  }

  /** 이미지 교체 시 이전 파일 정리용. 실패해도 호출부가 무시할 수 있게 예외를 그대로 던집니다. */
  public void deleteImageFor(String path, UserRole... allowedRoles) {
    currentUserService.requireRole(allowedRoles);
    deleteImageInternal(path);
  }

  private AdminStorageUploadResponse uploadImageInternal(String path, MultipartFile file) {
    String normalizedPath = normalizePath(path);
    if (file == null || file.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "업로드할 파일이 필요합니다.");
    }
    try {
      HttpRequest request = baseRequest("/storage/v1/object/" + BUCKET + "/" + encodePath(normalizedPath))
          .PUT(HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
          .header("Content-Type", file.getContentType() == null ? "application/octet-stream" : file.getContentType())
          .header("x-upsert", "true")
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      ensureSuccess(response);
      return new AdminStorageUploadResponse(normalizedPath, publicUrl(normalizedPath));
    } catch (IOException e) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "이미지를 업로드하지 못했습니다.");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.BAD_GATEWAY, "이미지 업로드 요청이 중단되었습니다.");
    }
  }

  public void deleteImage(String path) {
    requireAdmin();
    deleteImageInternal(path);
  }

  private void deleteImageInternal(String path) {
    String normalizedPath = normalizePath(path);
    try {
      String body = objectMapper.writeValueAsString(Map.of("prefixes", List.of(normalizedPath)));
      HttpRequest request = baseRequest("/storage/v1/object/" + BUCKET)
          .method("DELETE", HttpRequest.BodyPublishers.ofString(body))
          .header("Content-Type", "application/json")
          .build();
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
      ensureSuccess(response);
    } catch (IOException e) {
      throw new ApiException(HttpStatus.BAD_GATEWAY, "이미지를 삭제하지 못했습니다.");
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new ApiException(HttpStatus.BAD_GATEWAY, "이미지 삭제 요청이 중단되었습니다.");
    }
  }

  private void requireAdmin() {
    currentUserService.requireRole(UserRole.ADMIN);
  }

  private HttpRequest.Builder baseRequest(String path) {
    String serviceRoleKey = supabaseProperties.serviceRoleKey();
    if (serviceRoleKey == null || serviceRoleKey.isBlank()) {
      throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SUPABASE_SERVICE_ROLE_KEY가 설정되어 있지 않습니다.");
    }
    return HttpRequest.newBuilder(URI.create(projectUrl() + path))
        .header("Authorization", "Bearer " + serviceRoleKey)
        .header("apikey", serviceRoleKey);
  }

  private void ensureSuccess(HttpResponse<String> response) {
    if (response.statusCode() >= 200 && response.statusCode() < 300) return;
    throw new ApiException(HttpStatus.BAD_GATEWAY, "Supabase Storage 요청 실패: " + response.statusCode());
  }

  private String projectUrl() {
    String url = supabaseProperties.url();
    if (url != null && !url.isBlank()) return url.replaceAll("/+$", "");
    String jwksUrl = supabaseProperties.jwksUrl();
    if (jwksUrl != null && jwksUrl.contains("/auth/")) {
      return jwksUrl.substring(0, jwksUrl.indexOf("/auth/")).replaceAll("/+$", "");
    }
    throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "SUPABASE_URL 또는 SUPABASE_JWKS_URL 설정이 필요합니다.");
  }

  private String publicUrl(String path) {
    return projectUrl() + "/storage/v1/object/public/" + BUCKET + "/" + encodePath(path);
  }

  private String normalizePrefix(String prefix) {
    return String.valueOf(prefix == null ? "" : prefix).trim().replaceAll("^/+", "").replaceAll("/+$", "");
  }

  private String normalizePath(String path) {
    String normalized = String.valueOf(path == null ? "" : path).trim().replaceAll("^/+", "");
    if (normalized.isBlank() || normalized.endsWith("/")) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "유효한 이미지 path가 필요합니다.");
    }
    return normalized;
  }

  private String encodePath(String path) {
    String[] parts = path.split("/");
    List<String> encoded = new ArrayList<>();
    for (String part : parts) {
      encoded.add(URLEncoder.encode(part, StandardCharsets.UTF_8).replace("+", "%20"));
    }
    return String.join("/", encoded);
  }
}
