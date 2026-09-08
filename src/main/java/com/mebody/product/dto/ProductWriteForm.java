package com.mebody.product.dto;

import com.mebody.product.domain.ProductStatus;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * 상품 등록·수정 폼(multipart 의 텍스트 파트).
 * 사진은 이 폼이 아니라 별도의 MultipartFile 로 받습니다 — 등록 시 필수라서
 * "빠뜨릴 수 있는 선택 필드"처럼 보이지 않게 분리했습니다.
 *
 * 수정에서는 null 인 필드를 "바꾸지 않음"으로 취급합니다.
 */
public record ProductWriteForm(
    String name,
    String description,
    BigDecimal price,
    String category,
    ProductStatus status,
    UUID sellerId
) {}
