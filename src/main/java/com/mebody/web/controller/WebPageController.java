package com.mebody.web.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebPageController {
  @GetMapping("/")
  public String home() {
    return "forward:/index.html";
  }

  @GetMapping("/admin")
  public String admin() {
    return "forward:/index.html";
  }

  /** 로그인한 회원 화면. 같은 index.html 을 쓰고 web.js 가 경로로 뷰를 고른다. */
  @GetMapping("/me")
  public String me() {
    return "forward:/index.html";
  }

  @GetMapping("/privacy")
  public String privacy() {
    return "forward:/privacy.html";
  }

  @GetMapping("/terms")
  public String terms() {
    return "forward:/terms.html";
  }

  @GetMapping("/sample")
  public String sample() {
    return "forward:/sample/index.html";
  }
}
