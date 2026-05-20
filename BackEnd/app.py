# app.py
from flask import Flask, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor
from Vibe_modules import SecurityGuard, CampusSeeder

app = Flask(__name__)

def get_db_connection():
    return psycopg2.connect(
        host="localhost", database="postgres", user="postgres",
        password="kuun0727", port="5432"
    )

# 비즈니스 객체 생성
guard = SecurityGuard()
seeder = CampusSeeder(get_db_connection)

# [API 1] 주변 탐색 API (리더님 및 2학년 연동용)
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
            SELECT p.id, p.content, p.place_name, p.category,
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
    
    # 1학년이 완성할 객체에 일 맡기기
    result = seeder.inject_seeds(data_from_1st_year)
    
    # 1학년이 리턴 형식을 맞춰왔는지 확인하고 응답
    if result and result.get("status") == "success":
        return jsonify({"message": f"성공! {result['count']}개 데이터 적재 완료."}), 201
    else:
        error_msg = result.get("message") if result else "함수가 아무것도 리턴하지 않았습니다 (None)"
        return jsonify({"message": "시드 주입 실패", "error": error_msg}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)