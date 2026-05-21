'use client';
import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    kakao: any;
  }
}

export default function Home() {
  // 지도 인스턴스들
  const [mainMap, setMainMap] = useState<any>(null);
  const [miniMap, setMiniMap] = useState<any>(null);
  
  // 왼쪽 글쓰기 창 열림/닫힘 상태 관리
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // 🌟 우측 상단 카테고리 필터 상태 관리 (기본값: 전체)
  const [activeFilter, setActiveFilter] = useState('전체');
  
  // 위치 관련 상태 (기본 전북대 중심)
  const [currentCoords, setCurrentCoords] = useState({ lat: 35.8115, lng: 127.1484 });
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // 미니맵 전용 선택 마커 및 반경 원(Circle) 레퍼런스
  const miniMarkerRef = useRef<any>(null);
  const miniCircleRef = useRef<any>(null);
  const mainMarkersRef = useRef<any[]>([]);

  // 게시글 작성 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('분실물');
  const [derivedPlaceName, setDerivedPlaceName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // 카테고리 목록 정의
  const categories = ['전체', '분실물', '습득물', '자유게시판', '질문'];

  // 1. 메인 지도 초기화
  const initMainMap = () => {
    if (window.kakao && window.kakao.maps) {
      const container = document.getElementById('main-map');
      const options = {
        center: new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng),
        level: 4,
      };
      const map = new window.kakao.maps.Map(container, options);
      setMainMap(map);

      // 내 현재 위치 기본 마커 표시
      const locPosition = new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng);
      new window.kakao.maps.Marker({
        map: map,
        position: locPosition,
        title: "내 현재 위치"
      });
    }
  };

  // 2. 사용자의 실제 GPS 위치 들고오기
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setCurrentCoords({ lat, lng });
          if (mainMap) {
            mainMap.setCenter(new window.kakao.maps.LatLng(lat, lng));
          }
        },
        (err) => console.error("GPS 가져오기 실패, 기본 위치 사용:", err)
      );
    }
  }, [mainMap]);

  // 3. 🌟 마커 데이터 땡겨오기 (카테고리 필터 쿼리 추가!)
  const loadNearbyMarkers = () => {
    if (!mainMap) return;

    mainMarkersRef.current.forEach(m => m.setMap(null));
    mainMarkersRef.current = [];

    // 백엔드 API에 카테고리 필터 조건 파라미터(`&category=...`)를 붙여서 요청하도록 연동
    const categoryParam = activeFilter !== '전체' ? `&category=${encodeURIComponent(activeFilter)}` : '';
    
    fetch(`http://127.0.0.1:5000/api/posts/nearby?lat=${currentCoords.lat}&lng=${currentCoords.lng}&radius=1500${categoryParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;

        const newMarkers: any[] = [];

        data.forEach((post: any) => {
          const markerPosition = new window.kakao.maps.LatLng(post.lat, post.lng);
          
          let markerImage = null;
          if (post.is_popular) {
            const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/2012/img/marker_p.png';
            const imageSize = new window.kakao.maps.Size(45, 45);
            markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);
          }

          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            image: markerImage,
          });

          marker.setMap(mainMap);

          const iwContent = `
            <div style="padding:10px; font-size:12px; color:#333; width:220px; line-height:1.4;">
              ${post.is_popular ? `<span style="background-color:#ef4444; color:white; padding:2px 6px; font-size:10px; font-weight:bold; border-radius:4px; margin-bottom:4px; display:inline-block;">🔥 인기글</span>` : ''}
              <br/>
              <span style="color:#4f46e5; font-weight:bold;">[${post.category}]</span> 
              <span style="font-weight:800; font-size:13px; color:#111;">${post.title || '제목 없음'}</span><br/>
              <span style="font-size:11px; color:#666;">📍 ${post.place_name}</span><br/>
              ${post.image_url ? `<img src="${post.image_url}" style="width:100%; height:80px; object-fit:cover; margin:5px 0; border-radius:6px;"/>` : ''}
              <p style="margin-top:6px; font-weight:500; color:#444;">${post.content}</p>
            </div>
          `;
          const infowindow = new window.kakao.maps.InfoWindow({
            content: iwContent,
            removable: true
          });

          window.kakao.maps.event.addListener(marker, 'click', () => {
            infowindow.open(mainMap, marker);
          });

          newMarkers.push(marker);
        });

        mainMarkersRef.current = newMarkers;
      })
      .catch((err) => console.error('마커 로딩 실패:', err));
  };

  // 🌟 지도 인스턴스, GPS 좌표, 혹은 '선택한 필터'가 바뀔 때마다 마커 리로드!
  useEffect(() => {
    loadNearbyMarkers();
  }, [mainMap, currentCoords, activeFilter]);

  // 4. 미니맵 초기화 및 반경 50m 제한
  const initMiniMap = () => {
    const container = document.getElementById('mini-map');
    if (!container || miniMap) return;

    const options = {
      center: new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng),
      level: 2,
    };
    const mMap = new window.kakao.maps.Map(container, options);
    setMiniMap(mMap);

    const centerPos = new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng);

    const circle = new window.kakao.maps.Circle({
      center: centerPos,
      radius: 50,
      strokeWeight: 2,
      strokeColor: '#4f46e5',
      strokeOpacity: 0.8,
      strokeStyle: 'dashed',
      fillColor: '#4f46e5',
      fillOpacity: 0.15
    });
    circle.setMap(mMap);
    miniCircleRef.current = circle;

    const marker = new window.kakao.maps.Marker({
      position: centerPos,
      draggable: true
    });
    marker.setMap(mMap);
    miniMarkerRef.current = marker;

    setSelectedCoords({ lat: currentCoords.lat, lng: currentCoords.lng });
    updateAddress(currentCoords.lng, currentCoords.lat);

    window.kakao.maps.event.addListener(marker, 'dragend', function() {
      const currentMarkerPos = marker.getPosition();
      const polyline = new window.kakao.maps.Polyline({
        path: [centerPos, currentMarkerPos]
      });

      if (polyline.getLength() > 50) {
        alert("📍 반경 50m 이내에만 핀을 꽂을 수 있습니다!");
        marker.setPosition(centerPos);
        setSelectedCoords({ lat: currentCoords.lat, lng: currentCoords.lng });
        updateAddress(currentCoords.lng, currentCoords.lat);
      } else {
        setSelectedCoords({ lat: currentMarkerPos.getLat(), lng: currentMarkerPos.getLng() });
        updateAddress(currentMarkerPos.getLng(), currentMarkerPos.getLat());
      }
    });
  };

  const updateAddress = (lng: number, lat: number) => {
    const geocoder = new window.kakao.maps.services.Geocoder();
    geocoder.coord2Address(lng, lat, function (result: any, status: any) {
      if (status === window.kakao.maps.services.Status.OK) {
        const buildingName = result[0].road_address?.building_name;
        const addressName = result[0].address.address_name;
        setDerivedPlaceName(buildingName ? `전북대 ${buildingName}` : addressName);
      } else {
        setDerivedPlaceName('전북대 내부 특정 장소');
      }
    });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoords || !title || !content) return;

    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('content', content);
      formData.append('place_name', derivedPlaceName);
      formData.append('category', category);
      formData.append('lat', String(selectedCoords.lat));
      formData.append('lng', String(selectedCoords.lng));
      formData.append('user_id', '1');
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const response = await fetch('http://127.0.0.1:5000/api/posts', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        alert('📍 성공적으로 게시글을 발행했습니다!');
        setTitle('');
        setContent('');
        setImageFile(null);
        setImagePreview('');
        setIsSidebarOpen(false); 
        setMiniMap(null); 
        loadNearbyMarkers();
      } else {
        alert('서버 저장 실패');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="w-screen h-screen flex bg-gray-50 overflow-hidden font-sans relative">
      <Script
        src="//dapi.kakao.com/v2/maps/sdk.js?appkey=5a9cc8fe6f58844aafaa5b7e9a482c0b&libraries=services&autoload=false"
        strategy="afterInteractive"
        onLoad={() => {
          window.kakao.maps.load(() => {
            initMainMap();
          });
        }}
      />

      {/* 왼쪽 레이아웃: 토글식 인스타 스타일 글작성 사이드바 */}
      <section 
        className={`fixed md:relative top-0 left-0 w-[420px] h-full bg-white shadow-2xl z-40 flex flex-col border-r border-gray-100 overflow-y-auto p-6 transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
        style={{ position: isSidebarOpen ? 'relative' : 'absolute' }}
      >
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-black text-gray-900 tracking-tight">📝 새 게시글 작성</h2>
            <p className="text-xs text-gray-400 mt-1">동네 소식을 지도에 남겨보세요.</p>
          </div>
          <button 
            type="button"
            onClick={() => { setIsSidebarOpen(false); setMiniMap(null); }}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 text-sm font-bold"
          >
            ✕ 닫기
          </button>
        </div>

        <form onSubmit={handlePostSubmit} className="space-y-4 flex-1 flex flex-col">
          {/* 카테고리 선택 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">카테고리</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="분실물">🎁 분실물</option>
              <option value="습득물">🔍 습득물</option>
              <option value="자유게시판">💬 자유게시판</option>
              <option value="질문">❓ 질문</option>
            </select>
          </div>

          {/* 제목 입력 칸 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">제목</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 font-semibold"
              placeholder="게시글의 제목을 적어주세요."
              required
            />
          </div>

          {/* 본문 내용 작성 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">내용 작성</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800 h-24 resize-none"
              placeholder="공유할 상세 내용을 적어주세요."
              required
            />
          </div>

          {/* 이미지 업로드 UI */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">📷 현장 사진 첨부</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageChange}
              className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
            {imagePreview && (
              <img src={imagePreview} alt="미리보기" className="mt-3 w-full h-28 object-cover rounded-xl border border-gray-100" />
            )}
          </div>

          {/* 미니 지도 위치 탐색 */}
          <div className="flex-1 min-h-[200px] flex flex-col">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-gray-500">📍 위치 지정 (반경 50m 내 드래그)</label>
              <button 
                type="button" 
                onClick={initMiniMap} 
                className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100"
              >
                미니맵 불러오기
              </button>
            </div>
            
            <div id="mini-map" className="w-full h-full bg-gray-100 rounded-2xl border border-gray-200 shadow-inner relative overflow-hidden" style={{ minHeight: '140px' }}>
              <span className="absolute inset-0 m-auto h-fit w-fit text-xs font-semibold text-gray-400 pointer-events-none">불러오기 버튼을 눌러주세요</span>
            </div>
            <p className="text-[11px] text-indigo-600 font-bold mt-2 bg-indigo-50/50 p-2 rounded-lg">🎯 확정 주소: {derivedPlaceName}</p>
          </div>

          {/* 발행 버튼 */}
          <button
            type="submit"
            className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
          >
            포스트 발행하기 ✨
          </button>
        </form>
      </section>

      {/* 오른쪽 레이아웃: 메인 전체 지도 */}
      <section className="flex-1 h-full relative">
        <div id="main-map" className="w-full h-full" />

        {/* 🌟 우측 상단 카테고리 필터 버튼 그룹 추가 (인스타/달리 감성) */}
        <div className="absolute top-5 right-5 z-30 flex space-x-2 bg-white/80 backdrop-blur-md p-2 rounded-2xl shadow-xl border border-white/40 max-w-[calc(100vw-30px)] overflow-x-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveFilter(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === cat
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 scale-105'
                  : 'bg-white/50 text-gray-600 hover:bg-white hover:text-gray-950'
              }`}
            >
              {cat === '전체' ? '🌐 ' : cat === '분실물' ? '🎁 ' : cat === '습득물' ? '🔍 ' : cat === '자유게시판' ? '💬 ' : '❓ '}
              {cat}
            </button>
          ))}
        </div>

        {/* 하단 중앙 글쓰기 플로팅 버튼 */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-4 rounded-full shadow-2xl z-30 flex items-center space-x-2 text-sm tracking-wide transition-all hover:scale-105 active:scale-95 border-2 border-white/20"
          >
            <span className="text-lg">✏️</span>
            <span>동네 소식 적기</span>
          </button>
        )}
      </section>
    </main>
  );
}