package com.mebody.product.service;

import com.mebody.admin.dto.AdminStorageUploadResponse;
import com.mebody.admin.service.AdminStorageService;
import com.mebody.common.exception.ApiException;
import com.mebody.common.exception.NotFoundException;
import com.mebody.common.security.CurrentUser;
import com.mebody.common.security.CurrentUserService;
import com.mebody.product.domain.Product;
import com.mebody.product.domain.ProductStatus;
import com.mebody.product.dto.ProductDto;
import com.mebody.product.dto.ProductWriteForm;
import com.mebody.product.repository.ProductRepository;
import com.mebody.user.domain.UserRole;
import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * 서버(관리자·판매자 콘솔)에서 상품을 등록·수정하는 서비스.
 *
 * <p><b>사진은 등록 시 필수입니다.</b> 세 겹으로 막습니다:
 * <ol>
 *   <li>화면 — 파일을 고르기 전에는 등록 버튼이 눌리지 않습니다(편의).</li>
 *   <li>여기 — 파일이 없거나 이미지가 아니면 400 으로 거절하고, 저장 자체를 하지 않습니다.</li>
 *   <li>DB — 039 마이그레이션의 products_image_required CHECK 제약이 ACTIVE 상품의
 *       빈 image_url 을 거절합니다. API 를 우회해도 막힙니다.</li>
 * </ol>
 *
 * <p>순서가 중요합니다. <b>이미지를 먼저 Storage 에 올리고</b>, 성공한 URL 로 행을 만듭니다.
 * 업로드가 실패하면 상품 행은 생기지 않습니다 — 사진 없는 상품이 남지 않습니다.
 */
@Service
public class ProductAdminService {
  private static final Logger log = LoggerFactory.getLogger(ProductAdminService.class);

  /** 마켓 화면(MarketScreen)이 아는 카테고리. 여기 없는 값은 화면에 안 뜨므로 미리 막습니다. */
  public static final Set<String> CATEGORIES = Set.of("release", "strength", "stretch", "support", "food");

  private static final Set<String> IMAGE_CONTENT_TYPES =
      Set.of("image/jpeg", "image/png", "image/webp", "image/gif", "image/avif");
  private static final long MAX_IMAGE_BYTES = 8L * 1024 * 1024;
  private static final String IMAGE_PREFIX = "products";

  private final ProductRepository productRepository;
  private final AdminStorageService adminStorageService;
  private final CurrentUserService currentUserService;

  public ProductAdminService(
      ProductRepository productRepository,
      AdminStorageService adminStorageService,
      CurrentUserService currentUserService) {
    this.productRepository = productRepository;
    this.adminStorageService = adminStorageService;
    this.currentUserService = currentUserService;
  }

  // ---------------------------------------------------------------- 조회

  /** 관리자는 전부, 판매자는 자기 상품만. 상태와 무관하게(DRAFT 포함) 봅니다. */
  @Transactional(readOnly = true)
  public List<ProductDto> list(boolean sellerScope) {
    CurrentUser user = requireManager(sellerScope);
    List<Product> products = productRepository.findAllByOrderByCreatedAtDesc();
    return products.stream()
        .filter(p -> !sellerScope || user.id().equals(p.getSellerId()))
        .map(ProductDto::from)
        .toList();
  }

  // ---------------------------------------------------------------- 등록

  @Transactional
  public ProductDto create(ProductWriteForm form, MultipartFile image, boolean sellerScope) {
    CurrentUser user = requireManager(sellerScope);

    // 저장 전에 먼저 막는다. 사진 없는 등록은 여기서 끝난다.
    requireImage(image);

    String name = requireText(form.name(), "상품명");
    String category = requireCategory(form.category());
    BigDecimal price = requirePrice(form.price());
    ProductStatus status = form.status() == null ? ProductStatus.ACTIVE : form.status();
    UUID sellerId = resolveSellerId(form.sellerId(), user, sellerScope);

    AdminStorageUploadResponse uploaded = upload(image, sellerScope);

    Product product = new Product();
    product.setName(name);
    product.setDescription(trimToNull(form.description()));
    product.setPrice(price);
    product.setCategory(category);
    product.setStatus(status);
    product.setSellerId(sellerId);
    product.setImageUrl(uploaded.publicUrl());

    return ProductDto.from(productRepository.save(product));
  }

  // ---------------------------------------------------------------- 수정

  /**
   * 사진은 수정에서 선택입니다(이미 있는 걸 그대로 두는 경우). 다만
   * <b>사진이 없는 상품을 ACTIVE 로 두려면 이번에 사진을 올려야 합니다</b> —
   * 038 이전에 만들어져 사진이 없는 기존 상품도 이 규칙으로 채워집니다.
   */
  @Transactional
  public ProductDto update(UUID id, ProductWriteForm form, MultipartFile image, boolean sellerScope) {
    CurrentUser user = requireManager(sellerScope);
    Product product = productRepository.findById(id)
        .orElseThrow(() -> new NotFoundException("상품을 찾을 수 없습니다."));
    if (sellerScope && !user.id().equals(product.getSellerId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "내 상품만 수정할 수 있습니다.");
    }

    if (form.name() != null) product.setName(requireText(form.name(), "상품명"));
    if (form.description() != null) product.setDescription(trimToNull(form.description()));
    if (form.price() != null) product.setPrice(requirePrice(form.price()));
    if (form.category() != null) product.setCategory(requireCategory(form.category()));
    if (form.status() != null) product.setStatus(form.status());
    if (!sellerScope && form.sellerId() != null) product.setSellerId(form.sellerId());

    String previousPath = null;
    if (image != null && !image.isEmpty()) {
      requireImage(image);
      previousPath = storagePathOf(product.getImageUrl());
      product.setImageUrl(upload(image, sellerScope).publicUrl());
    }

    if (product.getStatus() == ProductStatus.ACTIVE && isBlank(product.getImageUrl())) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "판매 중(ACTIVE) 상품에는 사진이 반드시 있어야 합니다. 사진을 함께 올려주세요.");
    }

    ProductDto saved = ProductDto.from(productRepository.save(product));

    // 교체된 옛 이미지는 정리하되, 실패해도 수정 자체는 성공으로 둡니다.
    if (previousPath != null) {
      try {
        adminStorageService.deleteImageFor(previousPath, managerRoles(sellerScope));
      } catch (RuntimeException e) {
        // 스토리지 정리 실패는 상품 수정 결과에 영향을 주지 않습니다. 다만 조용히 넘기면
        // 고아 이미지가 쌓이는 걸 아무도 모르게 되므로 로그로 남깁니다.
        log.warn("옛 상품 이미지 삭제 실패 (path={}): {}", previousPath, e.toString());
      }
    }
    return saved;
  }

  // ---------------------------------------------------------------- 삭제

  /**
   * 상품을 지우고 사진도 함께 정리합니다.
   * order_items.product_id 는 ON DELETE SET NULL 이라 과거 주문 내역은 남습니다.
   */
  @Transactional
  public void delete(UUID id, boolean sellerScope) {
    CurrentUser user = requireManager(sellerScope);
    Product product = productRepository.findById(id)
        .orElseThrow(() -> new NotFoundException("상품을 찾을 수 없습니다."));
    if (sellerScope && !user.id().equals(product.getSellerId())) {
      throw new ApiException(HttpStatus.FORBIDDEN, "내 상품만 삭제할 수 있습니다.");
    }
    String path = storagePathOf(product.getImageUrl());
    productRepository.delete(product);
    if (path != null) {
      try {
        adminStorageService.deleteImageFor(path, managerRoles(sellerScope));
      } catch (RuntimeException e) {
        // 사진 정리 실패가 상품 삭제를 되돌릴 이유는 아닙니다.
        log.warn("삭제한 상품의 이미지 정리 실패 (path={}): {}", path, e.toString());
      }
    }
  }

  // ---------------------------------------------------------------- 내부

  private AdminStorageUploadResponse upload(MultipartFile image, boolean sellerScope) {
    String path = IMAGE_PREFIX + "/" + UUID.randomUUID() + extensionOf(image);
    return adminStorageService.uploadImageFor(path, image, managerRoles(sellerScope));
  }

  private UserRole[] managerRoles(boolean sellerScope) {
    return sellerScope
        ? new UserRole[] {UserRole.SELLER, UserRole.ADMIN}
        : new UserRole[] {UserRole.ADMIN};
  }

  private CurrentUser requireManager(boolean sellerScope) {
    return currentUserService.requireRole(managerRoles(sellerScope));
  }

  /** 판매자 콘솔에서는 항상 본인 id 로 귀속합니다 — 남의 이름으로 올릴 수 없습니다. */
  private UUID resolveSellerId(UUID requested, CurrentUser user, boolean sellerScope) {
    if (sellerScope) return user.id();
    if (requested != null) return requested;
    throw new ApiException(HttpStatus.BAD_REQUEST, "판매자를 선택해주세요.");
  }

  private void requireImage(MultipartFile image) {
    if (image == null || image.isEmpty()) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "상품 사진은 필수입니다. 사진 파일을 함께 올려주세요.");
    }
    if (image.getSize() > MAX_IMAGE_BYTES) {
      throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "상품 사진은 8MB 이하만 올릴 수 있습니다.");
    }
    String contentType = image.getContentType() == null ? "" : image.getContentType().toLowerCase(Locale.ROOT);
    if (!IMAGE_CONTENT_TYPES.contains(contentType)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "이미지 파일(JPG·PNG·WEBP·GIF·AVIF)만 올릴 수 있습니다.");
    }
  }

  private String extensionOf(MultipartFile image) {
    String original = image.getOriginalFilename() == null ? "" : image.getOriginalFilename();
    int dot = original.lastIndexOf('.');
    String ext = dot > -1 ? original.substring(dot + 1).toLowerCase(Locale.ROOT) : "";
    if (!ext.matches("[a-z0-9]{1,5}")) {
      String contentType = image.getContentType() == null ? "" : image.getContentType();
      ext = switch (contentType) {
        case "image/png" -> "png";
        case "image/webp" -> "webp";
        case "image/gif" -> "gif";
        case "image/avif" -> "avif";
        default -> "jpg";
      };
    }
    return "." + ext;
  }

  /** 공개 URL 에서 버킷 안의 경로를 되돌립니다. 우리가 올린 products/ 경로만 대상으로 합니다. */
  private String storagePathOf(String publicUrl) {
    if (isBlank(publicUrl)) return null;
    int marker = publicUrl.indexOf("/storage/v1/object/public/images/");
    if (marker < 0) return null;
    String path = java.net.URLDecoder.decode(
        publicUrl.substring(marker + "/storage/v1/object/public/images/".length()),
        java.nio.charset.StandardCharsets.UTF_8);
    return path.startsWith(IMAGE_PREFIX + "/") ? path : null;
  }

  private String requireText(String value, String label) {
    String trimmed = trimToNull(value);
    if (trimmed == null) throw new ApiException(HttpStatus.BAD_REQUEST, label + "을(를) 입력해주세요.");
    return trimmed;
  }

  private String requireCategory(String value) {
    String trimmed = trimToNull(value);
    if (trimmed == null || !CATEGORIES.contains(trimmed)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "카테고리는 " + String.join(", ", CATEGORIES) + " 중 하나여야 합니다.");
    }
    return trimmed;
  }

  private BigDecimal requirePrice(BigDecimal price) {
    if (price == null || price.signum() < 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, "가격은 0원 이상으로 입력해주세요.");
    }
    return price;
  }

  private String trimToNull(String value) {
    if (value == null) return null;
    String trimmed = value.trim();
    return trimmed.isEmpty() ? null : trimmed;
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
