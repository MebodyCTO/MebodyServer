package com.mebody.product.dto;

import com.mebody.product.domain.Product;
import com.mebody.product.domain.ProductStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ProductDto(
    UUID id,
    UUID sellerId,
    String name,
    String description,
    BigDecimal price,
    String category,
    String imageUrl,
    ProductStatus status,
    OffsetDateTime createdAt
) {
  public static ProductDto from(Product product) {
    return new ProductDto(
        product.getId(),
        product.getSellerId(),
        product.getName(),
        product.getDescription(),
        product.getPrice(),
        product.getCategory(),
        product.getImageUrl(),
        product.getStatus(),
        product.getCreatedAt()
    );
  }
}
