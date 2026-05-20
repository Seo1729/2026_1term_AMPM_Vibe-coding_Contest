from flask import Flask, jsonify, request
from flask_cors import CORS  # 1. CORS를 실제 일하는 메인 앱으로 구출!
import psycopg2
from psycopg2.extras import RealDictCursor
from Vibe_modules import SecurityGuard, CampusSeeder  # 2. 소문자 파일명 매칭 완료

app = Flask(__name__)
CORS(app)  # 3. 세훈이 및 프론트팀 연동을 위한 CORS 완전 허용

def get_db_connection():
    return psycopg2.connect(
        host="localhost", database="postgres", user="postgres",
        password="kuun0727", port="5432"
    )

# 비즈니스 객체 생성
guard = SecurityGuard()
seeder = CampusSeeder(get_db_connection)

# [API 1] 주변 탐색 API
@app.route('/api/posts/nearby', methods=['GET'])
def get_nearby_posts():
    try:
        lat = float(request.args.get('lat', 35.8115))
        lng = float(request.args.get('lng', 127.1484))
        radius = float(request.args.get('radius', 300.0))

        if not guard.is_valid_coordinates(lat, lng):
            return jsonify({"status": "error", "message": "유효하지 않은 GPS 좌표 범위입니다."}), 400

        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        query = """
            SELECT p.id, p.content, p.place_name, p.category, p.user_id,
                   ST_X(p.geom) as lng, ST_Y(p.geom) as lat,
                   ST_Distance(p.geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) as distance
            FROM posts p
            WHERE ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
            ORDER BY distance ASC;
        """
        cursor.execute(query, (lng, lat, lng, lat, radius))
        posts = cursor.fetchall()
        
        clean_posts = [p for p in posts if guard.is_clean_content(p['content'])]

        cursor.close()
        conn.close()
        return jsonify(clean_posts)

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

# [API 2] 1학년 팀원의 미션 검증용 엔드포인트
@app.route('/api/admin/seed', methods=['POST'])
def run_db_seed():
    data_from_1st_year = request.json 
    result = seeder.inject_seeds(data_from_1st_year)
    
    if result and result.get("status") == "success":
        return jsonify({"message": f"성공! {result['count']}개 데이터 적재 완료."}), 201
    else:
        error_msg = result.get("message") if result else "함수가 아무것도 리턴하지 않았습니다 (None)"
        return jsonify({"message": "시드 주입 실패", "error": error_msg}), 500

# 4. 유령 공간에 있던 세훈이용 임시 가짜 API를 메인 서버로 안전하게 이동!
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)