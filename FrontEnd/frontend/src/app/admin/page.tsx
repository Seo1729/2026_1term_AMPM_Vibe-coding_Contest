'use client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface Post {
  id: number;
  title: string;
  content: string;
  category: string;
  place_name: string;
  lat: number;
  lng: number;
  user_id: number;
  image_url: string;
  is_popular: number;
  likes: number;
  created_at: string;
}

export default function AdminPage() {
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot
  );
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState<Partial<Post>>({});
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  // 게시글 목록 로드
  const loadPosts = async () => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/posts');
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (err) {
      console.error('게시글 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  // 게시글 삭제
  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`http://127.0.0.1:5000/api/posts/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        alert('✅ 게시글이 삭제되었습니다.');
        loadPosts();
      } else {
        alert('❌ 삭제 실패');
      }
    } catch (err) {
      console.error('삭제 실패:', err);
    }
  };

  // 게시글 수정 시작
  const handleEditStart = (post: Post) => {
    setEditingId(post.id);
    setEditData(post);
    setEditImageFile(null);
    setEditImagePreview(post.image_url || '');
  };

  // 수정 모드에서 이미지 변경
  const handleEditImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setEditImageFile(file);
      setEditImagePreview(URL.createObjectURL(file));
    }
  };

  // 게시글 수정 저장
  const handleEditSave = async (id: number) => {
    if (!editData.title || !editData.content) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('title', editData.title as string);
      formData.append('content', editData.content as string);
      formData.append('category', editData.category as string);
      formData.append('place_name', editData.place_name as string);
      formData.append('likes', String(editData.likes || 0));
      if (editImageFile) {
        formData.append('image', editImageFile);
      }

      const response = await fetch(`http://127.0.0.1:5000/api/posts/${id}`, {
        method: 'PUT',
        body: formData,
      });

      if (response.ok) {
        alert('✅ 게시글이 수정되었습니다.');
        setEditingId(null);
        setEditImageFile(null);
        setEditImagePreview('');
        loadPosts();
      } else {
        alert('❌ 수정 실패');
      }
    } catch (err) {
      console.error('수정 실패:', err);
    }
  };

  // 인기글 토글
  const handleTogglePopular = async (id: number) => {
    try {
      const response = await fetch(`http://127.0.0.1:5000/api/posts/${id}/toggle-popular`, {
        method: 'PUT',
      });

      if (response.ok) {
        const result = await response.json();
        alert(`✅ 인기글 상태 변경: ${result.is_popular ? '활성화' : '비활성화'}`);
        loadPosts();
      } else {
        alert('❌ 변경 실패');
      }
    } catch (err) {
      console.error('토글 실패:', err);
    }
  };

  const filteredPosts = filter === 'popular' 
    ? posts.filter(p => p.is_popular) 
    : posts;

  const categories = ['분실물', '습득물', '자유게시판', '질문'];

  if (!isMounted) {
    return <main className="min-h-screen bg-gray-50" suppressHydrationWarning />;
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-black text-gray-900 mb-2">📋 게시글 관리</h1>
            <p className="text-gray-500 font-medium">총 {posts.length}개 게시글</p>
          </div>
          <Link 
            href="/"
            className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
          >
            ← 돌아가기
          </Link>
        </div>

        {/* 필터 */}
        <div className="flex space-x-3 mb-6">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              filter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            전체 ({posts.length})
          </button>
          <button
            onClick={() => setFilter('popular')}
            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
              filter === 'popular'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            ⭐ 인기글 ({posts.filter(p => p.is_popular).length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500 font-semibold">로딩 중...</p>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-400 font-semibold">게시글이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                {editingId === post.id ? (
                  // 수정 모드
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">제목</label>
                      <input
                        type="text"
                        value={editData.title || ''}
                        onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">카테고리</label>
                      <select
                        value={editData.category || ''}
                        onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm font-medium"
                      >
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">장소</label>
                      <input
                        type="text"
                        value={editData.place_name || ''}
                        onChange={(e) => setEditData({ ...editData, place_name: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">내용</label>
                      <textarea
                        value={editData.content || ''}
                        onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm font-medium h-24 resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">좋아요 수</label>
                      <input
                        type="number"
                        value={editData.likes || 0}
                        onChange={(e) => setEditData({ ...editData, likes: parseInt(e.target.value) })}
                        className="w-full p-3 border border-gray-200 rounded-lg text-sm font-medium"
                        min="0"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-2">📷 사진</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleEditImageChange}
                        className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                      />
                      {editImagePreview && (
                        <img src={editImagePreview} alt="미리보기" className="mt-3 w-full h-28 object-cover rounded-xl border border-gray-100" />
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditSave(post.id)}
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 text-sm"
                      >
                        💾 저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 font-bold rounded-lg hover:bg-gray-300 text-sm"
                      >
                        ✕ 취소
                      </button>
                    </div>
                  </div>
                ) : (
                  // 조회 모드
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="inline-block text-xs font-bold text-white px-2 py-1 rounded-md bg-indigo-600">
                            {post.category}
                          </span>
                          {post.is_popular && (
                            <span className="inline-block text-xs font-bold text-white px-2 py-1 rounded-md bg-amber-500">
                              ⭐ 인기글
                            </span>
                          )}
                          <span className="inline-block text-xs font-bold text-white px-2 py-1 rounded-md bg-red-500">
                            ❤️ {post.likes}
                          </span>
                        </div>
                        <h3 className="text-lg font-black text-gray-900">{post.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">📍 {post.place_name}</p>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(post.created_at).toLocaleDateString('ko-KR')}
                      </div>
                    </div>

                    {post.image_url && (
                      <div className="w-full h-40 mb-4 overflow-hidden rounded-lg border border-gray-100">
                        <img
                          src={post.image_url}
                          alt="게시글 이미지"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    <p className="text-sm text-gray-700 mb-4 line-clamp-2">{post.content}</p>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditStart(post)}
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200 text-xs transition-all"
                      >
                        ✏️ 수정
                      </button>
                      <button
                        onClick={() => handleTogglePopular(post.id)}
                        className={`flex-1 px-3 py-2 font-bold rounded-lg text-xs transition-all ${
                          post.is_popular
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {post.is_popular ? '⭐ 인기글 해제' : '☆ 인기글 지정'}
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 text-xs transition-all"
                      >
                        🗑️ 삭제
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
