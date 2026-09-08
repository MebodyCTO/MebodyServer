package com.mebody.product.domain;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "products")
public class Product {
  @Id
  @GeneratedValue(strategy = GenerationType.UUID)
  private UUID id;

  @Column(name = "seller_id")
  private UUID sellerId;

  @Column(nullable = false)
  private String name;

  private String description;
  private BigDecimal price;

  /** 마켓 카테고리(release/strength/stretch/support/food). 037 마이그레이션에서 추가된 컬럼. */
  private String category;

  /**
   * Supabase Storage(images 버킷)의 공개 URL.
   * ACTIVE 상품은 이 값이 반드시 있어야 합니다 — 039 마이그레이션의 CHECK 제약이 DB에서도 막습니다.
   */
  @Column(name = "image_url")
  private String imageUrl;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ProductStatus status = ProductStatus.DRAFT;

  /** created_at / updated_at 은 DB 기본값과 products_updated_at 트리거가 관리합니다. */
  @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
  private OffsetDateTime createdAt;

  @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
  private OffsetDateTime updatedAt;

  public UUID getId() { return id; }
  public UUID getSellerId() { return sellerId; }
  public String getName() { return name; }
  public String getDescription() { return description; }
  public BigDecimal getPrice() { return price; }
  public String getCategory() { return category; }
  public String getImageUrl() { return imageUrl; }
  public ProductStatus getStatus() { return status; }
  public OffsetDateTime getCreatedAt() { return createdAt; }
  public OffsetDateTime getUpdatedAt() { return updatedAt; }

  public void setSellerId(UUID sellerId) { this.sellerId = sellerId; }
  public void setName(String name) { this.name = name; }
  public void setDescription(String description) { this.description = description; }
  public void setPrice(BigDecimal price) { this.price = price; }
  public void setCategory(String category) { this.category = category; }
  public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
  public void setStatus(ProductStatus status) { this.status = status; }
}
