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


# 🚀 [객체 A] 1학년 팀원 공간 (결함 완전히 박살냄)
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
            
            cursor.execute("CREATE EXTENSION IF NOT EXISTS postgis;")            
            
            # 🛠️ 수정 1: 테이블 생성 시 빠져있던 user_id 컬럼 강제 추가
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS posts (
                    id SERIAL PRIMARY KEY,
                    content TEXT,
                    place_name TEXT,
                    category TEXT,
                    user_id INT NOT NULL,
                    geom GEOMETRY(Point, 4326)
                );
            """)
            
            cursor.execute("TRUNCATE TABLE posts RESTART IDENTITY CASCADE;")
            
            inserted_count = 0
            
            # 🛠️ 수정 2: INSERT 쿼리문에 user_id 컬럼과 매칭 파라미터(%s) 추가
            query = """
                INSERT INTO posts (content, place_name, category, user_id, geom)
                VALUES (%s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326));
            """
            
            for item in data_list:
                try:
                    lng = float(item.get('lng', 0.0))
                    lat = float(item.get('lat', 0.0))
                except (TypeError, ValueError):
                    continue 
                
                # 🛠️ 수정 3: 요청 데이터에 user_id가 없으면 기본값 1번 유저로 채워주는 방어 코드
                user_id = item.get('user_id', 1)
                
                cursor.execute(query, (
                    item.get('content', '내용 없음'),
                    item.get('place_name', '알 수 없는 장소'),
                    item.get('category', '일반'),
                    user_id,  # 쿼리에 유저 ID 주입
                    lng, 
                    lat
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