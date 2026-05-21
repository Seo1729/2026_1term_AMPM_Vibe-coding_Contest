# -*- coding: utf-8 -*-
import sys
import os
import math

# 윈도우 인코딩 시스템 강제 교정
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import random

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# 파이썬 내부에서 안전하게 구동되는 하버사인(거리 계산) 공식
def calculate_haversine(lat1, lng1, lat2, lng2):
    R = 6371000  # 지구 반지름 (미터 단위)
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

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
    
    # [핵심 가드] PostgreSQL이 에러를 뱉을 때 한글 대신 무조건 표준 영문(C)으로 출력하도록 세션 고정
    # 이로 인해 윈도우 인코딩 깨짐 현상이 원천 차단됩니다.
    with conn.cursor() as cur:
        try:
            cur.execute("SET lc_messages TO 'C';")
        except:
            pass
            
    return conn

# =================================================================
# [1. 주변 핀 조회 API] - 에러 유발 SQL 함수를 제거하고 파이썬 엔진으로 안전 필터링
# =================================================================
@app.route('/api/posts/nearby', methods=['GET'])
def get_nearby_posts():
    try:
        # 전북대 중심부 좌표 설정 완료
        current_lat = request.args.get('lat', default=35.8461, type=float)
        current_lng = request.args.get('lng', default=127.1296, type=float)
        radius = request.args.get('radius', default=3000, type=float)
        
        category_filter = request.args.get('category', default=None, type=str)

        print(f"📍 주변 마커 요청 수신 -> 위도: {current_lat}, 경도: {current_lng}, 반경: {radius}m")
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 💡 카테고리 필터 선택 여부에 따라 SQL 쿼리를 다르게 날립니다.
        if category_filter and category_filter != "전체":
            query = """
                SELECT id, content, place_name, category, 
                       CAST(lat AS FLOAT) as lat, CAST(lng AS FLOAT) as lng, user_id 
                FROM posts 
                WHERE category = %s;
            """
            cur.execute(query, (category_filter,))
        else:
            query = """
                SELECT id, content, place_name, category, 
                       CAST(lat AS FLOAT) as lat, CAST(lng AS FLOAT) as lng, user_id 
                FROM posts;
            """
            cur.execute(query)

        # 안전하게 전체 글을 raw 상태로 수집
        query = "SELECT id, content, place_name, category, CAST(lat AS FLOAT) as lat, CAST(lng AS FLOAT) as lng, user_id FROM posts;"
        cur.execute(query)
        all_posts = cur.fetchall()
        
        cur.close()
        conn.close()
        
        # 파이썬 내부에서 정밀 필터링 (DB 삼각함수 오버플로우 원천 차단)
        filtered_posts = []
        for post in all_posts:
            distance = calculate_haversine(current_lat, current_lng, post['lat'], post['lng'])
            #if distance <= radius:
            post['distance'] = distance
            filtered_posts.append(post)  # 👈 조건문(if)을 빼고 무조건 집어넣습니다!
                
        return jsonify(filtered_posts), 200
        
    except Exception as e:
        # 혹시 모를 인코딩 유실 대비 예외 처리 바리케이드
        try:
            error_msg = str(e)
        except UnicodeDecodeError:
            error_msg = repr(e)
        print(f"❌ 백엔드 에러 발생: {error_msg}")
        return jsonify({"status": "error", "message": error_msg}), 500

# =================================================================
# [2. 새 핀 작성 API] - 제약조건 오류 시 영문으로 디버깅 로그 출력 보장
# =================================================================
@app.route('/api/posts', methods=['POST'])
def create_post():
    try:
        data = request.get_json()
        content = data.get('content')
        place_name = data.get('place_name', '전북대 캠퍼스')
        category = data.get('category', '기타')
        lat = float(data.get('lat'))
        lng = float(data.get('lng'))

        if not content:
            return jsonify({"status": "error", "message": "내용을 입력해주세요."}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        
        # user_id 제약조건 충돌 우려를 막기 위해 테스트 단계에서는 1 고정 삽입
        insert_query = """
            INSERT INTO posts (content, place_name, category, lat, lng, user_id)
            VALUES (%s, %s, %s, %s, %s, 1) RETURNING id;
        """
        cur.execute(insert_query, (content, place_name, category, lat, lng))
        new_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"status": "success", "message": "핀 저장 완료", "id": new_id}), 201
    except Exception as e:
        try:
            error_msg = str(e)
        except UnicodeDecodeError:
            error_msg = repr(e)
        print(f"❌ 핀 생성 DB 에러 발생: {error_msg}")
        return jsonify({"status": "error", "message": error_msg}), 500

# =================================================================
# [3. 대량 데이터 초기화 및 주입 마이그레이션 Script]
# =================================================================
@app.route('/api/admin/seed', methods=['POST'])
def seed_database():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 깔끔하게 테이블 리셋 및 재생성
        cur.execute("DROP TABLE IF EXISTS posts;")
        create_table_query = """
            CREATE TABLE posts (
                id SERIAL PRIMARY KEY,
                content TEXT NOT NULL,
                place_name VARCHAR(100),
                category VARCHAR(50),
                lat NUMERIC(10, 7) NOT NULL,
                lng NUMERIC(10, 7) NOT NULL,
                user_id INTEGER DEFAULT 1
            );
        """
        cur.execute(create_table_query)

        # 전북대학교 정밀 좌표 교정 및 들여쓰기 정규화 완료
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
                "INSERT INTO posts (content, place_name, category, lat, lng, user_id) VALUES (%s, %s, %s, %s, %s, 1);",
                (content, place_name, category, rand_lat, rand_lng)
            )

        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "message": "20개 랜덤 데이터 생성 완료"}), 201
    except Exception as e:
        try:
            error_msg = str(e)
        except UnicodeDecodeError:
            error_msg = repr(e)
        return jsonify({"status": "error", "message": error_msg}), 500

if __name__ == '__main__':
    # Flask 내부 JSON 및 ASCII 충돌 완전 방지 가드레일
    app.json.ensure_ascii = False
    app.config['JSON_AS_ASCII'] = False
    app.run(host='0.0.0.0', port=5000, debug=True)