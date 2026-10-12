package com.mebody.common.config;

import com.mebody.common.security.SupabaseProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.NegatedRequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties({SupabaseProperties.class, com.mebody.billing.config.BillingProperties.class,
    com.mebody.ads.config.AdRewardProperties.class, com.mebody.auth.config.AuthSignupProperties.class})
public class SecurityConfig {

  /**
   * /api/** 가 아닌 모든 요청(홈, /sample, 정적 HTML) — JWT·Bearer 없이 허용.
   */
  @Bean
  @Order(1)
  public SecurityFilterChain publicWebFilterChain(HttpSecurity http) throws Exception {
    http
        .securityMatcher(new NegatedRequestMatcher(new AntPathRequestMatcher("/api/**")))
        .csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
    return http.build();
  }

  /** API만 JWT 검증 */
  @Bean
  @Order(2)
  public SecurityFilterChain apiFilterChain(HttpSecurity http) throws Exception {
    http
        .securityMatcher("/api/**")
        .csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.GET, "/api/public/health").permitAll()
            // 초대 링크 미리보기. 로그인 전에 "누가 불렀는지" 만 보여줍니다.
            // 수락(/api/invites/**)은 로그인이 필요합니다 — 로그인한 본인만 자기를 묶습니다.
            .requestMatchers(HttpMethod.GET, "/api/public/professional/invite/*").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/public/config").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/public/auth/signup").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/public/auth/config").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/public/auth/approve").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/public/auth/login", "/api/public/auth/reset").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/products", "/api/products/**").permitAll()
            // AdMob 이 부르는 콜백. 로그인 토큰이 없고, 신뢰의 근거는 요청에 붙은 ECDSA 서명이다.
            // (서명 검증은 AdMobSsvVerifier 가 한다 — 여기서 뚫는 건 인증뿐이다)
            .requestMatchers(HttpMethod.GET, "/api/ads/admob/ssv", "/api/ads/admob/ssv/health").permitAll()
            .anyRequest().authenticated())
        .oauth2ResourceServer(oauth -> oauth.jwt(Customizer.withDefaults()));
    return http.build();
  }

  @Bean
  public JwtDecoder jwtDecoder(SupabaseProperties properties) {
    if (hasText(properties.jwksUrl())) {
      return NimbusJwtDecoder.withJwkSetUri(properties.jwksUrl())
          .jwsAlgorithms(algorithms -> {
            algorithms.add(SignatureAlgorithm.ES256);
            algorithms.add(SignatureAlgorithm.RS256);
          })
          .build();
    }
    if (hasText(properties.jwtSecret())) {
      SecretKeySpec key = new SecretKeySpec(properties.jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
      return NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    }
    throw new IllegalStateException("SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL must be configured");
  }

  /**
   * 앱 웹뷰가 쓰는 주소. 기기 안에서만 나오는 값이라 운영 환경변수에 넣을 수 없습니다.
   * iOS 를 내게 되면 capacitor://localhost 를 여기에 더합니다.
   */
  private static final List<String> APP_WEBVIEW_ORIGINS = List.of("https://localhost");

  @Bean
  public CorsConfigurationSource corsConfigurationSource(@Value("${mebody.frontend-origin}") String frontendOrigin) {
    CorsConfiguration configuration = new CorsConfiguration();
    List<String> allowedOrigins = new java.util.ArrayList<>(
        java.util.Arrays.stream(frontendOrigin.split(","))
            .map(String::trim)
            .filter(origin -> !origin.isBlank())
            .toList());
    if (!allowedOrigins.contains("http://localhost:3000")) {
      allowedOrigins.add("http://localhost:3000");
    }
    if (!allowedOrigins.contains("http://127.0.0.1:3000")) {
      allowedOrigins.add("http://127.0.0.1:3000");
    }
    // 안드로이드 앱의 웹뷰 주소. 설정값이 아니라 **고정값**이라 코드에 둡니다
    // (Capacitor 안드로이드는 번들을 https://localhost 로 서빙합니다).
    //
    // 이게 빠져 있어서 APK 안에서 회원가입·로그인·비밀번호 재설정·탈퇴·전문가 초대가
    // 전부 CORS 403 이었습니다(실측 2026-10-12). 브라우저에서만 테스트하면 안 보입니다 —
    // 웹은 FRONTEND_ORIGIN 에 들어 있으니까요.
    for (String appOrigin : APP_WEBVIEW_ORIGINS) {
      if (!allowedOrigins.contains(appOrigin)) {
        allowedOrigins.add(appOrigin);
      }
    }
    configuration.setAllowedOrigins(allowedOrigins);
    configuration.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    configuration.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", configuration);
    return source;
  }

  private boolean hasText(String value) {
    return value != null && !value.isBlank();
  }
}
