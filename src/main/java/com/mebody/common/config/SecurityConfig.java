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
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(SupabaseProperties.class)
public class SecurityConfig {

  /**
   * 홈·/sample·정적 HTML — JWT 없이 접근 (oauth2ResourceServer 미적용).
   * oauth2와 permitAll만 쓰면 /sample 이 401 Bearer 가 나는 경우가 있어 분리합니다.
   */
  @Bean
  @Order(1)
  public SecurityFilterChain publicWebFilterChain(HttpSecurity http) throws Exception {
    http
        .securityMatcher(
            "/",
            "/admin",
            "/index.html",
            "/admin.html",
            "/privacy",
            "/terms",
            "/sample",
            "/sample/**",
            "/privacy.html",
            "/terms.html",
            "/assets/**",
            "/favicon.ico",
            "/swagger-ui.html",
            "/swagger-ui/**",
            "/api-docs/**",
            "/actuator/health")
        .csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .authorizeHttpRequests(auth -> auth.anyRequest().permitAll());
    return http.build();
  }

  @Bean
  @Order(2)
  public SecurityFilterChain apiFilterChain(HttpSecurity http) throws Exception {
    http
        .csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers(HttpMethod.GET, "/api/public/config").permitAll()
            .requestMatchers(HttpMethod.POST, "/api/public/auth/signup").permitAll()
            .requestMatchers(HttpMethod.GET, "/api/products", "/api/products/**").permitAll()
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
