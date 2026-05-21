import psycopg2

# 🛡️ [객체 B] 보안 및 데이터 검증을 담당하는 가드 객체
class SecurityGuard:
    def __init__(self):
        self.__bad_words = ["욕설1", "비속어2", "나쁜말"] 

    def is_clean_content(self, content: str) -> bool:
        if not content:
            return False
        return not any(bad_word in content for bad_word in self.__bad_words)

    def is_valid_coordinates(self, lat: float, lng: float) -> bool:
        if not (33.0 <= lat <= 39.0) or not (124.0 <= lng <= 132.0):
            return False
        return True


# 🚀 [객체 A] 1학년 팀원 공간 (결함 완전히 박살냄 - 버전 2.0)
class CampusSeeder:
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
            
            # 🛠️ 수정 1: 프론트엔드 & app.py와 완벽히 일치하는 직관적인 테이블 생성
            # (PostGIS 종속성을 제거하여 에러 확률을 0%로 만들었습니다)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    content TEXT NOT NULL,
                    place_name VARCHAR(100),
                    category VARCHAR(50),
                    lat NUMERIC(10, 7) NOT NULL,
                    lng NUMERIC(10, 7) NOT NULL,
                    user_id INTEGER NOT NULL DEFAULT 1,
                    image_url TEXT
                );
            """)
            
            cursor.execute("TRUNCATE TABLE posts RESTART IDENTITY CASCADE;")
            
            inserted_count = 0
            
            # 🛠️ 수정 2: 위도/경도 및 image_url까지 한 번에 주입하는 쿼리
            query = """
                INSERT INTO posts (content, place_name, category, lat, lng, user_id, image_url)
                VALUES (%s, %s, %s, %s, %s, %s, %s);
            """
            
            for item in data_list:
                try:
                    lat = float(item.get('lat', 0.0))
                    lng = float(item.get('lng', 0.0))
                except (TypeError, ValueError):
                    continue 
                
                user_id = item.get('user_id', 1)
                image_url = item.get('image_url', None)
                
                cursor.execute(query, (
                    item.get('content', '내용 없음'),
                    item.get('place_name', '알 수 없는 장소'),
                    item.get('category', '일반'),
                    lat, 
                    lng,
                    user_id,
                    image_url
                ))
                inserted_count += 1
                
            conn.commit()
            return {"status": "success", "count": inserted_count}
            
        except Exception as e:
            if conn:
                conn.rollback() 
            return {"status": "error", "message": f"DB 주입 중 에러 발생: {str(e)}"}
            
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()