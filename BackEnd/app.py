# -*- coding: utf-8 -*-
import sys
import os
import math
import sqlite3
import json
from datetime import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
import random

# 윈도우 인코딩 시스템 강제 교정
if sys.version_info >= (3, 7):
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": ["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000", "http://127.0.0.1:3001"]}})

# SQLite 데이터베이스 경로
DB_PATH = os.path.join(os.path.dirname(__file__), 'vibe_db.sqlite')

# 하버사인(거리 계산) 공식
def calculate_haversine(lat1, lng1, lat2, lng2):
    R = 6371000  # 지구 반지름 (미터 단위)
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# DB 초기화 함수
def init_db():
    """데이터베이스 및 테이블 생성"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            place_name TEXT,
            category TEXT,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            user_id INTEGER DEFAULT 1,
            image_url TEXT,
            is_popular INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

# DB 연결 함수
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# 시작 시 DB 초기화
init_db()

# =================================================================
# [1. 모든 게시글 조회 API]
# =================================================================
@app.route('/api/posts', methods=['GET'])
def get_all_posts():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 모든 게시글 조회
        cur.execute('''
            SELECT id, title, content, place_name, category, 
                   lat, lng, user_id, image_url, is_popular, created_at
            FROM posts
            ORDER BY created_at DESC
        ''')
        
        posts = []
        for row in cur.fetchall():
            posts.append({
                'id': row['id'],
                'title': row['title'],
                'content': row['content'],
                'place_name': row['place_name'],
                'category': row['category'],
                'lat': row['lat'],
                'lng': row['lng'],
                'user_id': row['user_id'],
                'image_url': row['image_url'],
                'is_popular': row['is_popular'],
                'created_at': row['created_at']
            })
        
        cur.close()
        conn.close()
        
        return jsonify(posts), 200
        
    except Exception as e:
        print(f"❌ 게시글 조회 에러: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [2. 새 게시글 작성 API]
# =================================================================
@app.route('/api/posts', methods=['POST'])
def create_post():
    try:
        title = request.form.get('title', '제목 없음')
        content = request.form.get('content')
        place_name = request.form.get('place_name', '전북대 캠퍼스')
        category = request.form.get('category', '기타')
        lat = float(request.form.get('lat'))
        lng = float(request.form.get('lng'))
        user_id = request.form.get('user_id', 1)

        # 📷 이미지 파일 처리 (선택사항)
        image_url = None
        image_file = request.files.get('image')
        if image_file:
            image_url = f"https://dummyimage.com/400x300/4f46e5/ffffff.png&text={image_file.filename}"

        if not content:
            return jsonify({"status": "error", "message": "내용을 입력해주세요."}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        
        # 데이터베이스에 새 게시글 추가
        cur.execute('''
            INSERT INTO posts (title, content, place_name, category, lat, lng, user_id, image_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (title, content, place_name, category, lat, lng, user_id, image_url))
        
        new_id = cur.lastrowid
        conn.commit()
        cur.close()
        conn.close()

        print(f"✅ 새 게시글 저장 완료 - ID: {new_id}, 제목: {title}")
        return jsonify({"status": "success", "message": "핀 저장 완료", "id": new_id}), 201
        
    except Exception as e:
        print(f"❌ 게시글 생성 에러: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [3. 주변 게시글 조회 API]
# =================================================================
@app.route('/api/posts/nearby', methods=['GET'])
def get_nearby_posts():
    try:
        current_lat = request.args.get('lat', default=35.8115, type=float)
        current_lng = request.args.get('lng', default=127.1484, type=float)
        radius = request.args.get('radius', default=3000, type=float)
        category_filter = request.args.get('category', default=None, type=str)

        print(f"📍 주변 마커 요청 -> 위도: {current_lat}, 경도: {current_lng}, 반경: {radius}m")
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 모든 게시글 조회
        cur.execute('''
            SELECT id, title, content, place_name, category, lat, lng, user_id, image_url, is_popular
            FROM posts
            ORDER BY created_at DESC
        ''')
        
        all_posts = cur.fetchall()
        cur.close()
        conn.close()
        
        # 카테고리 필터링 및 거리 계산
        filtered_posts = []
        for row in all_posts:
            # 카테고리 필터
            if category_filter and category_filter != "전체":
                if row['category'] != category_filter:
                    continue
            
            post_data = {
                'id': row['id'],
                'title': row['title'],
                'content': row['content'],
                'place_name': row['place_name'],
                'category': row['category'],
                'lat': row['lat'],
                'lng': row['lng'],
                'user_id': row['user_id'],
                'image_url': row['image_url'],
                'is_popular': row['is_popular'],
                'distance': calculate_haversine(current_lat, current_lng, row['lat'], row['lng'])
            }
            filtered_posts.append(post_data)
        
        return jsonify(filtered_posts), 200
        
    except Exception as e:
        print(f"❌ 주변 게시글 조회 에러: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [4. 게시글 수정 API]
# =================================================================
@app.route('/api/posts/<int:post_id>', methods=['PUT'])
def update_post(post_id):
    try:
        title = request.form.get('title')
        content = request.form.get('content')
        category = request.form.get('category')
        place_name = request.form.get('place_name')
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 게시글 수정
        cur.execute('''
            UPDATE posts 
            SET title = ?, content = ?, category = ?, place_name = ?
            WHERE id = ?
        ''', (title, content, category, place_name, post_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ 게시글 수정 완료 - ID: {post_id}")
        return jsonify({"status": "success", "message": "게시글 수정 완료"}), 200
        
    except Exception as e:
        print(f"❌ 게시글 수정 에러: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [5. 게시글 삭제 API]
# =================================================================
@app.route('/api/posts/<int:post_id>', methods=['DELETE'])
def delete_post(post_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 게시글 삭제
        cur.execute('DELETE FROM posts WHERE id = ?', (post_id,))
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ 게시글 삭제 완료 - ID: {post_id}")
        return jsonify({"status": "success", "message": "게시글 삭제 완료"}), 200
        
    except Exception as e:
        print(f"❌ 게시글 삭제 에러: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [6. 인기글 토글 API]
# =================================================================
@app.route('/api/posts/<int:post_id>/toggle-popular', methods=['PUT'])
def toggle_popular(post_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 현재 인기글 상태 조회
        cur.execute('SELECT is_popular FROM posts WHERE id = ?', (post_id,))
        result = cur.fetchone()
        
        if not result:
            return jsonify({"status": "error", "message": "게시글을 찾을 수 없습니다."}), 404
        
        current_status = result[0] if result[0] is not None else 0
        new_status = 1 if current_status == 0 else 0
        
        # 인기글 상태 업데이트
        cur.execute('UPDATE posts SET is_popular = ? WHERE id = ?', (new_status, post_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ 인기글 상태 변경 - ID: {post_id}, 상태: {new_status}")
        return jsonify({"status": "success", "is_popular": bool(new_status)}), 200
        
    except Exception as e:
        print(f"❌ 인기글 토글 에러: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [7. 데이터베이스 초기화 (샘플 데이터 주입)]
# =================================================================
@app.route('/api/admin/seed', methods=['POST'])
def seed_database():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 기존 데이터 제거
        cur.execute("DELETE FROM posts")
        
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
            title = f"[{i+1}번 핀] " + random.choice(contents_pool).split("!")[0]
            content = random.choice(contents_pool)
            category = random.choice(categories_pool)
            place_name = spot["name"] + " 근처"

            cur.execute(
                "INSERT INTO posts (title, content, place_name, category, lat, lng, user_id, image_url) VALUES (?, ?, ?, ?, ?, ?, 1, NULL)",
                (title, content, place_name, category, rand_lat, rand_lng)
            )

        conn.commit()
        cur.close()
        conn.close()
        
        print(f"✅ 샘플 데이터 20개 생성 완료")
        return jsonify({"status": "success", "message": "새 구조로 20개 랜덤 데이터 생성 완료"}), 201
    except Exception as e:
        print(f"❌ 데이터 시딩 에러: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

# =================================================================
# [5. 데이터베이스 상태 확인]
# =================================================================
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) as count FROM posts")
        result = cur.fetchone()
        cur.close()
        conn.close()
        
        return jsonify({
            "status": "ok",
            "database": "SQLite",
            "db_path": DB_PATH,
            "total_posts": result[0]
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == '__main__':
    app.json.ensure_ascii = False
    app.config['JSON_AS_ASCII'] = False
    print("=" * 60)
    print("🌟 Vibe 백엔드 서버 시작")
    print(f"📁 데이터베이스: {DB_PATH}")
    print("🌐 http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)