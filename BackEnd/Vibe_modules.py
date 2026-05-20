# vibe_modules.py
import psycopg2
import requests
import time
from flask import Flask, jsonify, request
from flask_cors import CORS


app = Flask(__name__)
CORS(app)  # 2. 모든 도메인에서의 접근을 허용 (연동 치트키)
# 🛡️ [객체 B] 보안 및 데이터 검증을 담당하는 가드 객체 (리더님 담당)
class SecurityGuard:
    def __init__(self):
        self.__bad_words = ["욕설1", "비속어2", "나쁜말"] 

    def is_clean_content(self, content: str) -> bool:
        """게시글 내용에 비속어가 없는지 검사"""
        if not content:
            return False
        return not any(bad_word in content for bad_word in self.__bad_words)

    def is_valid_coordinates(self, lat: float, lng: float) -> bool:
        """위경도 값이 대한민국 권역을 벗어나지 않는지 검증"""
        if not (33.0 <= lat <= 39.0) or not (124.0 <= lng <= 132.0):
            return False
        return True


# 🚀 [객체 A] 1학년 팀원 전용 공간 (진짜 실력 향상을 위해 아예 비워둠)
class CampusSeeder:
    def __init__(self, db_conn_func):
        """
        db_conn_func: 매개변수로 넘어오는 DB 연결 함수입니다.
        self.get_connection()을 호출하면 DB 커넥션 객체가 반환됩니다.
        """
        self.get_connection = db_conn_func

    def inject_seeds(self, campus_posts: list) -> dict:
        """
        🔥 [1학년 미션] 
        프론트엔드나 클라이언트가 전송한 가상 게시글 리스트(campus_posts)를 
        우리 PostgreSQL(PostGIS) 데이터베이스에 자동으로 삽입(INSERT)하는 로직을 완성하세요.
        
        - campus_posts 구조 예시: [['내용1', '장소1', '카테고리1', 경도, 위도], ...]
        - 힌트 1: 데이터를 넣기 전에 테이블을 비워주는(TRUNCATE) 게 좋습니다.
        - 힌트 2: 위치 데이터는 ST_SetSRID와 ST_MakePoint를 활용해 공간 데이터로 변환해야 합니다.
        
        - 리턴 형식: 
          성공 시 -> {"status": "success", "count": 넣은 데이터 개수}
          실패 시 -> {"status": "error", "message": str(e)}
        """
        # -------------------------------------------------------------
        # ⚠️ 여기를 직접 채워 넣으세요! 리더님은 절대 먼저 만지지 않습니다.
        # -------------------------------------------------------------
        pass


# 📡 [객체 C] 백엔드 엔진의 헬스체크 및 API 가동 상태 모니터링 객체 (리더님 담당)
class ServerMonitor:
    def __init__(self, target_url: str):
        self.target_url = target_url

    def start_loop_testing(self, interval_sec: int = 5):
        """지정한 시간마다 서버에 테스트 쿼리를 날려 상태 확인"""
        print(f"🟢 API 자동화 모니터링 객체 가동 시작... (대상: {self.target_url})")
        while True:
            try:
                test_url = f"{self.target_url}?lat=35.8115&lng=127.1484&radius=300"
                response = requests.get(test_url, timeout=3)
                
                if response.status_code == 200:
                    print(f"✅ [{time.strftime('%X')}] 서버 정상 작동 중 | 응답 데이터 수: {len(response.json())}개")
                else:
                    print(f"⚠️ [{time.strftime('%X')}] 서버 상태 이상 | Code: {response.status_code}")
            except Exception as e:
                print(f"❌ [{time.strftime('%X')}] 서버가 죽었거나 응답이 없습니다! 에러 원인: {e}")
                
            time.sleep(interval_sec)

# 세훈이가 DB 상황에 구애받지 않고 화면 개발을 할 수 있게 해주는 임시 가짜 API
@app.route('/api/posts/mock', methods=['GET'])
def get_mock_posts():
    return jsonify([
        {
            "id": 999,
            "content": "[임시] 연동 테스트용 정문 에어팟 분실물 데이터입니다.",
            "place_name": "전북대 정문",
            "category": "분실물",
            "lat": 35.8115,
            "lng": 127.1484,
            "distance": 0.0
        }
    ])