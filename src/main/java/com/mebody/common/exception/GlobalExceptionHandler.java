package com.mebody.common.exception;

import com.mebody.common.response.ApiResponse;
import jakarta.validation.ConstraintViolationException;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;

@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ApiResponse<Void>> handleApiException(ApiException ex) {
    return ResponseEntity.status(ex.getStatus()).body(ApiResponse.error(ex.getMessage()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
    String message = ex.getBindingResult().getFieldErrors().stream()
        .map(this::formatFieldError)
        .collect(Collectors.joining(", "));
    return ResponseEntity.badRequest().body(ApiResponse.error(message));
  }

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<ApiResponse<Void>> handleConstraint(ConstraintViolationException ex) {
    return ResponseEntity.badRequest().body(ApiResponse.error(ex.getMessage()));
  }

  /**
   * multipart 필수 파트/파라미터 누락. 상품 등록에서 사진을 빼면 여기로 옵니다 —
   * 500 이 아니라 "사진이 필요하다"는 400 이 나가야 화면이 제대로 안내할 수 있습니다.
   */
  @ExceptionHandler({MissingServletRequestPartException.class, MissingServletRequestParameterException.class})
  public ResponseEntity<ApiResponse<Void>> handleMissingPart(Exception ex) {
    String field = ex instanceof MissingServletRequestPartException part
        ? part.getRequestPartName()
        : ((MissingServletRequestParameterException) ex).getParameterName();
    String message = "image".equals(field)
        ? "상품 사진은 필수입니다. 사진 파일을 함께 올려주세요."
        : field + " 값이 필요합니다.";
    return ResponseEntity.badRequest().body(ApiResponse.error(message));
  }

  /** 상품 등록은 multipart 전용입니다. JSON 으로 부르면 415 — 500 이 아니라 이유가 보여야 합니다. */
  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  public ResponseEntity<ApiResponse<Void>> handleMediaType(HttpMediaTypeNotSupportedException ex) {
    return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
        .body(ApiResponse.error("이 요청은 multipart/form-data 로만 받습니다. 사진 파일을 함께 보내주세요."));
  }

  @ExceptionHandler(MaxUploadSizeExceededException.class)
  public ResponseEntity<ApiResponse<Void>> handleTooLarge(MaxUploadSizeExceededException ex) {
    return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
        .body(ApiResponse.error("상품 사진은 8MB 이하만 올릴 수 있습니다."));
  }

  /**
   * 없는 경로. <b>404 여야 합니다.</b>
   *
   * <p>예전에는 아래 {@code Exception.class} 핸들러가 이것까지 삼켜 <b>500</b> 을 돌려줬습니다.
   * {@code /app-ads.txt} 도, 아무 오타 경로도 전부 500 이었습니다. 500 은 "서버가 고장났다" 는
   * 뜻이라 크롤러·업타임 모니터·AdMob 의 app-ads.txt 검사가 장애로 읽습니다.
   * 없는 것은 없다고 답해야 합니다.
   *
   * <p>{@code NoResourceFoundException} 은 정적 파일이 없을 때(Spring Boot 3.2+),
   * {@code NoHandlerFoundException} 은 매핑된 컨트롤러가 없을 때 납니다.
   */
  @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
  public ResponseEntity<ApiResponse<Void>> handleNotFound(Exception ex) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND)
        .body(ApiResponse.error("요청하신 경로를 찾을 수 없습니다."));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
    // 진짜 예상 못 한 오류만 여기로 옵니다. 원인을 남기지 않으면 배포 환경에서 추적이 안 됩니다.
    System.err.println("[error] 처리하지 못한 예외: " + ex.getClass().getName() + " — " + ex.getMessage());
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(ApiResponse.error("서버 처리 중 오류가 발생했습니다."));
  }

  private String formatFieldError(FieldError error) {
    return error.getField() + ": " + (error.getDefaultMessage() == null ? "invalid" : error.getDefaultMessage());
  }
}
