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
 * 판매자 상품 관리 — 자기 상품만 보이고, seller_id 는 항상 본인으로 강제됩니다.
 * 사진 필수 규칙은 관리자 쪽과 동일한 서비스가 처리합니다.
 */
@RestController
@RequestMapping("/api/seller/products")
public class SellerProductController {
  private final ProductAdminService productAdminService;

  public SellerProductController(ProductAdminService productAdminService) {
    this.productAdminService = productAdminService;
  }

  @GetMapping
  public ApiResponse<List<ProductDto>> products() {
    return ApiResponse.ok(productAdminService.list(true));
  }

  @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<ProductDto> create(
      @RequestParam String name,
      @RequestParam(required = false) String description,
      @RequestParam BigDecimal price,
      @RequestParam String category,
      @RequestParam(required = false) ProductStatus status,
      @RequestParam MultipartFile image
  ) {
    ProductWriteForm form = new ProductWriteForm(name, description, price, category, status, null);
    return ApiResponse.ok(productAdminService.create(form, image, true), "상품이 등록되었습니다.");
  }

  @PatchMapping(path = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public ApiResponse<ProductDto> update(
      @PathVariable UUID id,
      @RequestParam(required = false) String name,
      @RequestParam(required = false) String description,
      @RequestParam(required = false) BigDecimal price,
      @RequestParam(required = false) String category,
      @RequestParam(required = false) ProductStatus status,
      @RequestParam(required = false) MultipartFile image
  ) {
    ProductWriteForm form = new ProductWriteForm(name, description, price, category, status, null);
    return ApiResponse.ok(productAdminService.update(id, form, image, true), "상품이 수정되었습니다.");
  }

  @DeleteMapping("/{id}")
  public ApiResponse<Void> delete(@PathVariable UUID id) {
    productAdminService.delete(id, true);
    return ApiResponse.ok(null, "상품이 삭제되었습니다.");
  }
}
