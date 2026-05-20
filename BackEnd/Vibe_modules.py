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
    """
    [1학년 미션: 가짜 데이터를 데이터베이스에 넣어주는 클래스]
    """
    def __init__(self, db_connection_fn):
        self.get_connection = db_connection_fn

    def inject_seeds(self, data_list):
        if not data_list or not isinstance(data_list, list):
            return {"status": "error", "message": "데이터가 비어있거나 배열 형식이 아닙니다."}

        conn = None
        cursor = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # PostGIS 및 테이블 생성 검증
            cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")            
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    content TEXT,
                    place_name TEXT,
                    category TEXT,
                    geom GEOMETRY(Point, 4326)
                );
            """)
            
            # 💡 보완 1: 시드 데이터가 중복으로 쌓이지 않도록 실행 전 테이블 초기화
            cursor.execute("TRUNCATE TABLE posts RESTART IDENTITY;")
            
            inserted_count = 0
            query = """
                INSERT INTO posts (content, place_name, category, geom)
                VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326));
            """
            
            for item in data_list:
                # 💡 보완 3: 혹시라도 좌표 데이터가 누락되었을 때 서버가 터지는 것 방지
                try:
                    lng = float(item.get('lng', 0.0))
                    lat = float(item.get('lat', 0.0))
                except (TypeError, ValueError):
                    continue # 잘못된 좌표 형식은 스킵하고 다음 데이터 진행
                
                cursor.execute(query, (
                    item.get('content', '내용 없음'),
                    item.get('place_name', '알 수 없는 장소'),
                    item.get('category', '일반'),
                    lng, 
                    lat
                ))
                inserted_count += 1
                
            conn.commit()
            return {"status": "success", "count": inserted_count}
            
        except Exception as e:
            if conn:
                conn.rollback() 
            return {"status": "error", "message": f"DB 주입 중 에러 발생: {str(e)}"}
            
        # 💡 보완 2: 성공하든 실패하든 DB 연결은 무조건 안전하게 닫기
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()


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