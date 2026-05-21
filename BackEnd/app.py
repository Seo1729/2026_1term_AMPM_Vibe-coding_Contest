# -*- coding: utf-8 -*-
import sys
import os

# 윈도우 환경에서 파이썬 내부 파일/문자열 처리 인코딩 시스템을 UTF-8로 강제 고정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import random

app = Flask(__name__)
# 프론트엔드 포트(3000) 접근 허용
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

# DB 연결 함수 (연결 파라미터 인코딩 완벽 방어)
def get_db_connection():
    # 윈도우 계정명이나 환경 변수에 한글이 섞여 오류가 나는 것을 막기 위해 환경 설정 강제 초기화
    os.environ['PGCLIENTENCODING'] = 'utf-8'
    
    conn = psycopg2.connect(
        host="localhost",
        database="vibe_db",
        user="postgres",
        password="kuun0727",  # 리더님의 실제 DB 비밀번호
        port="5432"
    )
    conn.set_client_encoding('UTF8')
    return conn

# 1. 주변 핀 조회 API
@app.route('/api/posts/nearby', methods=['GET'])
def get_nearby_posts():
    try:
        print("📍 주변 마커 조회 요청 정상 수신!")
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        query = "SELECT id, content, place_name, category, CAST(lat AS FLOAT) as lat, CAST(lng AS FLOAT) as lng, user_id FROM posts;"
        cur.execute(query)
        all_posts = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify(all_posts), 200
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ 백엔드 에러 발생: {error_msg}")
        return jsonify({"status": "error", "message": error_msg}), 500

# 2. 사용자가 직접 새 핀을 꼽는 API
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
        error_msg = str(e)
        print(f"❌ 핀 생성 에러 발생: {error_msg}")
        return jsonify({"status": "error", "message": error_msg}), 500

# 3. 전북대 20개 대량 랜덤 가짜 데이터 주입 스크립트
@app.route('/api/admin/seed', methods=['POST'])
def seed_database():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 기존 posts 테이블 초기화 및 재생성
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

        jbnu_spots = [
            {"name": "전북대 중앙도서관", "lat": 35.8151, "lng": 127.1422},
            {"name": "전북대 진수당", "lat": 35.8132, "lng": 127.1492},
            {"name": "전북대 정문", "lat": 35.8115, "lng": 127.1484},
            {"name": "전북대 구정문", "lat": 35.8165, "lng": 127.1415},
            {"name": "전북대 상대 건물", "lat": 35.8140, "lng": 127.1445},
            {"name": "전북대 공대 7호관", "lat": 35.8182, "lng": 127.1401},
            {"name": "전북대 인문대학", "lat": 35.8122, "lng": 127.1465},
            {"name": "전북대 제1학생회관", "lat": 35.8145, "lng": 127.1432}
        ]
        
        contents_pool = [
            "여기 에어팟 한쪽 주웠어요!", "전공책놓고가신분 분실물보관소로", 
            "벤치에 텀블러 있습니다.", "오늘 중도 고양이 귀엽네요", "노트북 어댑터 두고 가신 분"
        ]
        categories_pool = ["분실물", "습득물", "자유게시판", "질문"]

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
        error_msg = str(e)
        print(f"❌ 시드 데이터 생성 에러 발생: {error_msg}")
        return jsonify({"status": "error", "message": error_msg}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)