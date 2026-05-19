# app.py
from flask import Flask, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# DB 연결 설정 함수
def get_db_connection():
    return psycopg2.connect(
        host="localhost",
        database="postgres",
        user="postgres",
        password="YOUR_PASSWORD",  # ⚠️ 리더님의 실제 PostgreSQL 비밀번호를 적어주세요!
        port="5432"
    )

# [핵심 API] 내 주변 게시글 필터링 및 거리 계산 목록 반환
@app.route('/api/posts/nearby', methods=['GET'])
def get_nearby_posts():
    try:
        # 클라이언트(자바)가 보내준 위도, 경도, 반경 값 읽기 (기본값 설정)
        user_lng = float(request.args.get('lng', 127.1484))  # 전북대 정문 경도
        user_lat = float(request.args.get('lat', 35.8115))   # 전북대 정문 위도
        radius = float(request.args.get('radius', 300.0))    # 필터링 반경 (m)

        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # PostGIS 핵심 공간 쿼리 (거리 계산 및 정렬)
        query = """
            SELECT p.id, p.content, p.place_name, p.category,
                   ST_X(p.geom) as lng, ST_Y(p.geom) as lat,
                   ST_Distance(p.geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography) as distance
            FROM posts p
            WHERE ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography, %s)
            ORDER BY distance ASC;
        """
        
        cursor.execute(query, (user_lng, user_lat, user_lng, user_lat, radius))
        posts = cursor.fetchall()

        cursor.close()
        conn.close()
        
        # 자바가 읽기 편하도록 JSON 배열 형태로 곧바로 반환
        return jsonify(posts)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # 외부 접속 허용 (0.0.0.0), 포트 5000번 가동
    app.run(host='0.0.0.0', port=5000, debug=True)