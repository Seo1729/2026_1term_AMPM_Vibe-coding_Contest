# -*- coding: utf-8 -*-
import sys
import os
import math
from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import random

# 윈도우 인코딩 시스템 강제 교정
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

# 🌟 [핵심 수정] 파이썬이 인식할 수 있도록 app 정의를 데코레이터보다 무조건 위로 올렸습니다!
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# 하버사인(거리 계산) 공식
def calculate_haversine(lat1, lng1, lat2, lng2):
    R = 6371000  # 지구 반지름 (미터 단위)
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# DB 연결 함수
def get_db_connection():
    os.environ['PGCLIENTENCODING'] = 'utf-8'
    conn = psycopg2.connect(
        host="127.0.0.1",
        database="vibe_db",
        user="postgres",
        password="kuun0727",  # 리더님의 실제 DB 패스워드
        port="5432"
    )
    conn.set_client_encoding('UTF8')
    with conn.cursor() as cur:
        try:
            cur.execute("SET lc_messages TO 'C';")
        except:
            pass
    return conn

# =================================================================
# [1. 주변 핀 조회 API]
# =================================================================
@app.route('/api/posts/nearby', methods=['GET'])
def get_nearby_posts():
    try:
        current_lat = request.args.get('lat', default=35.8461, type=float)
        current_lng = request.args.get('lng', default=127.1296, type=float)
        radius = request.args.get('radius', default=3000, type=float)
        category_filter = request.args.get('category', default=None, type=str)

        print(f"📍 주변 마커 요청 수신 -> 위도: {current_lat}, 경도: {current_lng}, 반경: {radius}m")
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        if category_filter and category_filter != "전체":
            query = """
                SELECT id, content, place_name, category, 
                       CAST(lat AS FLOAT) as lat, CAST(lng AS FLOAT) as lng, user_id, image_url 
                FROM posts 
                WHERE category = %s;
            """
            cur.execute(query, (category_filter,))
        else:
            query = """
                SELECT id, content, place_name, category, 
                       CAST(lat AS FLOAT) as lat, CAST(lng AS FLOAT) as lng, user_id, image_url 
                FROM posts;
            """
            cur.execute(query)

        all_posts = cur.fetchall()
        cur.close()
        conn.close()
        
        filtered_posts = []
        for post in all_posts:
            distance = calculate_haversine(current_lat, current_lng, post['lat'], post['lng'])
            post['distance'] = distance
            filtered_posts.append(post)
                
        return jsonify(filtered_posts), 200
        
    except Exception as e:
        print(f"❌ 백엔드 에러 발생: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [2. 새 핀 작성 API] - FormData 수신 및 image_url 칼럼 추가 완료!
# =================================================================
@app.route('/api/posts', methods=['POST'])
def create_post():
    try:
        # 프론트엔드가 FormData 형식으로 데이터를 쏘기 때문에 form.get()으로 수집합니다.
        content = request.form.get('content')
        place_name = request.form.get('place_name', '전북대 캠퍼스')
        category = request.form.get('category', '기타')
        lat = float(request.form.get('lat'))
        lng = float(request.form.get('lng'))
        user_id = request.form.get('user_id', 1)

        # 📷 이미지 파일이 들어왔는지 확인 및 더미 처리
        image_file = request.files.get('image')
        image_url = None
        if image_file:
            image_url = f"https://dummyimage.com/400x300/4f46e5/ffffff.png&text={image_file.filename}"

        if not content:
            return jsonify({"status": "error", "message": "내용을 입력해주세요."}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        
        # 테이블 구조에 맞춰 image_url까지 한 번에 인서트
        insert_query = """
            INSERT INTO posts (content, place_name, category, lat, lng, user_id, image_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """
        cur.execute(insert_query, (content, place_name, category, lat, lng, user_id, image_url))
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "success", "message": "핀 저장 완료", "id": new_id}), 201
    except Exception as e:
        print(f"❌ 핀 생성 DB 에러 발생: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [3. 대량 데이터 초기화 및 주입 마이그레이션 Script] - image_url 반영
# =================================================================
@app.route('/api/admin/seed', methods=['POST'])
def seed_database():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("DROP TABLE IF EXISTS posts;")
        create_table_query = """
            CREATE TABLE posts (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                place_name VARCHAR(100),
                category VARCHAR(50),
                lat NUMERIC(10, 7) NOT NULL,
                lng NUMERIC(10, 7) NOT NULL,
                user_id INTEGER DEFAULT 1,
                image_url TEXT
            );
        """
        cur.execute(create_table_query)

        jbnu_spots = [
            {"name": "전북대 중앙도서관", "lat": 35.8462, "lng": 127.1285},
            {"name": "전북대 진수당", "lat": 35.8458, "lng": 127.1312},
            {"name": "전북대 정문", "lat": 35.8405, "lng": 127.1332},
            {"name": "전북대 구정문", "lat": 35.8443, "lng": 127.1227},
            {"name": "전북대 상대 건물", "lat": 35.8438, "lng": 127.1265},
            {"name": "전북대 공대 7호관", "lat": 35.8492, "lng": 127.1282},
            {"name": "전북대 인문대학", "lat": 35.8431, "lng": 127.1298},
            {"name": "전북대 제1학생회관", "lat": 35.8452, "lng": 127.1278}
        ]
        contents_pool = ["여기 에어팟 주웠어요!", "텀블러 분실물 보관소에 있습니다.", "오늘 중도 고양이 귀엽네요", "노트북 어댑터 주인 구함"]
        categories_pool = ["분실물", "습득물", "자유게시판"]

        for i in range(20):
            spot = random.choice(jbnu_spots)
            rand_lat = spot["lat"] + random.uniform(-0.001, 0.001)
            rand_lng = spot["lng"] + random.uniform(-0.001, 0.001)
            content = f"[{i+1}번 핀] " + random.choice(contents_pool)
            category = random.choice(categories_pool)
            place_name = spot["name"] + " 근처"

            cur.execute(
                "INSERT INTO posts (content, place_name, category, lat, lng, user_id, image_url) VALUES (%s, %s, %s, %s, %s, 1, NULL);",
                (content, place_name, category, rand_lat, rand_lng)
            )

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "message": "새 구조로 20개 랜덤 데이터 생성 완료"}), 201
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.json.ensure_ascii = False
    app.config['JSON_AS_ASCII'] = False
    app.run(host='0.0.0.0', port=5000, debug=True)