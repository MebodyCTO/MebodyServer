package com.mebody.product.controller;

import com.mebody.common.response.ApiResponse;
import com.mebody.product.domain.ProductStatus;
import com.mebody.product.dto.ProductDto;
import com.mebody.product.dto.ProductWriteForm;
import com.mebody.product.service.ProductAdminService;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 관리자 상품 관리. 등록은 <b>multipart 전용</b>이고 image 파트가 없으면 요청이 성립하지 않습니다
 * ({@code @RequestParam MultipartFile image} 는 required=true 라서 Spring 이 400 으로 거절합니다).
 * JSON 으로는 등록할 수 없게 consumes 를 multipart 로 묶어 두었습니다 — 사진 없이 부를 방법을 없앤 겁니다.
 */
@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {
  private final ProductAdminService productAdminService;

  public AdminProductController(ProductAdminService productAdminService) {
    this.productAdminService = productAdminService;
  }

  @GetMapping
  public ApiResponse<List<ProductDto>> products() {
    return ApiResponse.ok(productAdminService.list(false));
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<ProductDto> create(
      @RequestParam String name,
      @RequestParam(required = false) String description,
      @RequestParam BigDecimal price,
      @RequestParam String category,
      @RequestParam(required = false) ProductStatus status,
      @RequestParam(required = false) UUID sellerId,
      @RequestParam MultipartFile image
  ) {
    ProductWriteForm form = new ProductWriteForm(name, description, price, category, status, sellerId);
    return ApiResponse.ok(productAdminService.create(form, image, false), "상품이 등록되었습니다.");
  }

  @PatchMapping(path = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<ProductDto> update(
      @PathVariable UUID id,
      @RequestParam(required = false) String name,
      @RequestParam(required = false) String description,
      @RequestParam(required = false) BigDecimal price,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) ProductStatus status,
      @RequestParam(required = false) UUID sellerId,
      @RequestParam(required = false) MultipartFile image
  ) {
    ProductWriteForm form = new ProductWriteForm(name, description, price, category, status, sellerId);
    return ApiResponse.ok(productAdminService.update(id, form, image, false), "상품이 수정되었습니다.");
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Void> delete(@PathVariable UUID id) {
    productAdminService.delete(id, false);
    return ApiResponse.ok(null, "상품이 삭제되었습니다.");
  }
}
