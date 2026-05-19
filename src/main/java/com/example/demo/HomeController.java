package com.example.demo; // 패키지 이름을 Application.java와 똑같이 맞춤

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class HomeController {

    @GetMapping("/")
    public String home() {
        return "index"; // templates 폴더의 index.html을 찾습니다.
    }
}