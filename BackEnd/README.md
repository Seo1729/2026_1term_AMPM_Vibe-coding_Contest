### 📡 백엔드 API 연동 가이드 (For 프론트엔드)
- **기본 주소:** `http://10.55.59.95:5000` (리더님 현재 IP)
- **주변 탐색 API:** `GET /api/posts/nearby?lat=35.8115&lng=127.1484&radius=300`

**Next.js에서 호출하는 예시 코드:**
```javascript
fetch('[http://10.55.59.95:5000/api/posts/nearby?lat=35.8115&lng=127.1484&radius=300](http://10.55.59.95:5000/api/posts/nearby?lat=35.8115&lng=127.1484&radius=300)')
  .then(res => res.json())
  .then(data => console.log("서버 데이터:", data))
  .catch(err => console.error("연동 에러:", err));