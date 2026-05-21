from flask import request, jsonify

# =================================================================
# [수정됨] 새 핀 작성 API - JSON 대신 FormData 완벽 지원!
# =================================================================
@app.route('/api/posts', methods=['POST'])
def create_post():
    try:
        # 🔥 프론트에서 FormData로 보내므로 request.form.get()을 써야 합니다!
        content = request.form.get('content')
        place_name = request.form.get('place_name', '전북대 캠퍼스')
        category = request.form.get('category', '기타')
        lat = float(request.form.get('lat'))
        lng = float(request.form.get('lng'))
        user_id = request.form.get('user_id', 1)

        # 📷 이미지 파일 처리 (일단 파일명을 기반으로 더미 URL을 만들거나 빈 값 처리)
        image_file = request.files.get('image')
        image_url = None
        if image_file:
            # 실제 서비스에서는 여기서 AWS S3나 로컬 폴더에 이미지를 저장하고 그 경로를 넣습니다.
            # 지금은 UI에서 이미지가 뜨는 걸 확인하기 위해 임시 플레이스홀더를 넣습니다.
            image_url = f"https://dummyimage.com/400x300/3cd6a0/ffffff.png&text={image_file.filename}"

        if not content:
            return jsonify({"status": "error", "message": "내용을 입력해주세요."}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        
        # 💡 DB에 image_url도 같이 저장하도록 쿼리 업데이트!
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
        error_msg = str(e)
        print(f"❌ 핀 생성 DB 에러 발생: {error_msg}")
        return jsonify({"status": "error", "message": error_msg}), 500

# =================================================================
# [수정됨] 테이블 생성 시 image_url 컬럼 추가 (DB 리셋용)
# =================================================================
@app.route('/api/admin/seed', methods=['POST'])
def seed_database():
    # ... (기존 코드 유지) ...
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
                image_url TEXT  -- 🔥 프론트엔드를 위해 이미지 URL 칸 추가!
            );
        """
        cur.execute(create_table_query)
    # ... (나머지 로직은 기존과 동일) ...