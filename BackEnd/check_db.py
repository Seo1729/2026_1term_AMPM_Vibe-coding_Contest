import psycopg2

# ⚠️ 리더님의 실제 정보를 적어주세요
DB_USER = "postgres"
DB_PASS = "kuun0727"  # <-- 여기에 실제 비밀번호 입력

try:
    # 기본 postgres 데이터베이스에 먼저 접속합니다
    conn = psycopg2.connect(
        host="127.0.0.1",
        database="postgres",
        user=DB_USER,
        password=DB_PASS,
        port="5432"
    )
    conn.autocommit = True
    cur = conn.cursor()
    
    # 💡 깔끔하게 소문자 'vibe_db'로 데이터베이스를 생성합니다
    cur.execute("CREATE DATABASE vibe_db;")
    print("\n✅ [대성공] 'vibe_db' 데이터베이스가 성공적으로 생성되었습니다!")
    
    cur.close()
    conn.close()

except psycopg2.errors.DuplicateDatabase:
    print("\n💡 이미 'vibe_db' 데이터베이스가 존재합니다.")
except Exception as e:
    print(f"\n❌ 에러 발생: {e}")