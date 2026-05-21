# -*- coding: utf-8 -*-
import sys
import os

# 윈도우 환경 내부 문자열 처리 인코딩 강제 고정
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

from flask import Flask, jsonify, request
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import random

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})

def get_db_connection():
    os.environ['PGCLIENTENCODING'] = 'utf-8'
    
    # localhost 대신 명시적 IPv4 루프백 주소인 '127.0.0.1'을 사용하여 우회 차단
    conn = psycopg2.connect(
        host="127.0.0.1", 
        database="vibe_db",
        user="postgres",
        password="kuun0727",  # 리더님의 실제 DB 비밀번호
        port="5432"
    )
    conn.set_client_encoding('UTF8')
    return conn

# [1. 주변 핀 조회 API]
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

# [2. 새 핀 생성 API]
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
        return jsonify({"status": "error", "message": str(e)}), 500
# [1. 주변 핀 조회 API] - 프론트엔드의 lat, lng, radius 요청을 완벽히 수용하도록 수정
@app.route('/api/posts/nearby', methods=['GET'])
def get_nearby_posts():
    try:
        # 프론트엔드가 보낸 Query String 매개변수 안전하게 수신 (기본값 설정)
        current_lat = request.args.get('lat', default=35.8115, type=float)
        current_lng = request.args.get('lng', default=127.1484, type=float)
        radius = request.args.get('radius', default=1000, type=float) # 미터 단위 (예: 1500m)
        
        print(f"📍 주변 마커 조회 요청 수신 -> 기준위치: ({current_lat}, {current_lng}), 검색반경: {radius}m")
        
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # PostgreSQL에서 위도/경도 간 거리를 미터 단위로 계산하는 하버사인(Haversine) 유사 공식 적용
        # 지구 반지름 수치(6371000m)를 활용하여 radius 이내의 데이터만 필터링합니다.
        query = """
            SELECT id, content, place_name, category, 
                   CAST(lat AS FLOAT) as lat, CAST(lng AS FLOAT) as lng, user_id,
                   (6371000 * acos(
                       cos(radians(%s)) * cos(radians(CAST(lat AS FLOAT))) * cos(radians(CAST(lng AS FLOAT)) - radians(%s)) + 
                       sin(radians(%s)) * sin(radians(CAST(lat AS FLOAT)))
                   )) AS distance
            FROM posts
            WHERE (6371000 * acos(
                       cos(radians(%s)) * cos(radians(CAST(lat AS FLOAT))) * cos(radians(CAST(lng AS FLOAT)) - radians(%s)) + 
                       sin(radians(%s)) * sin(radians(CAST(lat AS FLOAT)))
                   )) <= %s;
        """
        
        # 파라미터 순서대로 매핑하여 안전하게 SQL 인젝션 방어 실행
        cur.execute(query, (current_lat, current_lng, current_lat, current_lat, current_lng, current_lat, radius))
        all_posts = cur.fetchall()
        
        cur.close()
        conn.close()
        
        return jsonify(all_posts), 200
        
    except Exception as e:
        error_msg = str(e)
        print(f"❌ 백엔드 계산 에러 발생: {error_msg}")
        return jsonify({"status": "error", "message": error_msg}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)