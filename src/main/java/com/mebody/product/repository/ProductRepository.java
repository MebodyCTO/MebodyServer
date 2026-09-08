package com.mebody.product.repository;

import com.mebody.product.domain.Product;
import com.mebody.product.domain.ProductStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductRepository extends JpaRepository<Product, UUID> {
  List<Product> findByStatusOrderByCreatedAtDesc(ProductStatus status);

  /** 관리 콘솔용 — 상태와 무관하게 전부. */
  List<Product> findAllByOrderByCreatedAtDesc();
}
