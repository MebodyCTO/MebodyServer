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
            .requestMatchers(HttpMethod.GET, "/api/public/config").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/public/auth/signup").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/public/auth/config").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/public/auth/approve").permitAll()
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
