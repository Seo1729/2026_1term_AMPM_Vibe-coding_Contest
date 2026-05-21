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
  
  // 위치 관련 상태 (기본 전북대 중심)
  const [currentCoords, setCurrentCoords] = useState({ lat: 35.8115, lng: 127.1484 });
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // 미니맵 전용 선택 마커 및 반경 원(Circle) 레퍼런스
  const miniMarkerRef = useRef<any>(null);
  const miniCircleRef = useRef<any>(null);
  const mainMarkersRef = useRef<any[]>([]);

  // 게시글 작성 폼 상태
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('분실물');
  const [derivedPlaceName, setDerivedPlaceName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

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

      // 현재 위치에 커스텀 마커나 이펙트 추가 가능 (여기서는 기본 마커로 내 위치 표시)
      const locPosition = new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng);
      new window.kakao.maps.Marker({
        map: map,
        position: locPosition,
        title: "내 현재 위치"
      });
    }
  };

  // 2. 사용자의 실제 GPS 위치 들고오기 (지도에 현재위치 표시)
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

  // 3. 서버에서 마커 데이터 땡겨와서 뿌리기 + 인기글 이펙트 분기
  const loadNearbyMarkers = () => {
    if (!mainMap) return;

    // 기존 메인 마커 초기화
    mainMarkersRef.current.forEach(m => m.setMap(null));
    mainMarkersRef.current = [];

    fetch(`http://127.0.0.1:5000/api/posts/nearby?lat=${currentCoords.lat}&lng=${currentCoords.lng}&radius=1500`)
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;

        const newMarkers: any[] = [];

        data.forEach((post: any) => {
          const markerPosition = new window.kakao.maps.LatLng(post.lat, post.lng);
          
          // 🔥 기획 변경안: 인기 게시글(예: 좋아요 10개 이상 혹은 조회수 높은 글) 마커 차별화 효과
          let markerImage = null;
          if (post.is_popular) { // 백엔드에서 판별해주거나 프론트에서 post.likes > 10 조건문 처리
            const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/2012/img/marker_p.png'; // 붉은색/튀는 색 마커
            const imageSize = new window.kakao.maps.Size(45, 45); // 더 크게 설정
            markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);
          }

          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            image: markerImage, // 인기글이면 커스텀 크기/이펙트 이미지 주입
          });

          marker.setMap(mainMap);

          // 인포윈도우 스타일 (인기글이면 테두리에 포인트를 주는 효과 추가 가능)
          const iwContent = `
            <div style="padding:10px; font-size:12px; color:#333; width:220px; line-height:1.4;">
              ${post.is_popular ? `<span style="background-color:#ef4444; color:white; padding:2px 6px; font-size:10px; font-weight:bold; border-radius:4px; margin-bottom:4px; display:inline-block;">🔥 인기글</span>` : ''}
              <br/><b style="color:#4f46e5;">[${post.category}]</b> ${post.place_name}<br/>
              ${post.image_url ? `<img src="${post.image_url}" style="width:100%; height:80px; object-fit:cover; margin:5px 0; border-radius:6px;"/>` : ''}
              <p style="margin-top:4px; font-weight:500;">${post.content}</p>
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

  useEffect(() => {
    loadNearbyMarkers();
  }, [mainMap, currentCoords]);

  // 4. 게시물 작성 창 아래 '작은 지도' 및 반경 50m 설정 로직
  const initMiniMap = () => {
    const container = document.getElementById('mini-map');
    if (!container || miniMap) return; // 이미 만들어졌으면 패스

    const options = {
      center: new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng),
      level: 2, // 50m 반경이 잘 보이게 타이트하게 줌
    };
    const mMap = new window.kakao.maps.Map(container, options);
    setMiniMap(mMap);

    const centerPos = new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng);

    // 반경 50m 원(Circle) 그리기
    const circle = new window.kakao.maps.Circle({
      center: centerPos,
      radius: 50, // 50미터 제한
      strokeWeight: 2,
      strokeColor: '#756ea8',
      strokeOpacity: 0.8,
      strokeStyle: 'dashed',
      fillColor: '#756ea8',
      fillOpacity: 0.2
    });
    circle.setMap(mMap);
    miniCircleRef.current = circle;

    // 움직일 수 있는 핀 생성
    const marker = new window.kakao.maps.Marker({
      position: centerPos,
      draggable: true // 드래그 가능하게 세팅
    });
    marker.setMap(mMap);
    miniMarkerRef.current = marker;

    // 최초 위치 값 세팅
    setSelectedCoords({ lat: currentCoords.lat, lng: currentCoords.lng });
    updateAddress(currentCoords.lng, currentCoords.lat);

    // 드래그가 끝났을 때 50m 제한 체크하기
    window.kakao.maps.event.addListener(marker, 'dragend', function() {
      const currentMarkerPos = marker.getPosition();
      const polyline = new window.kakao.maps.Polyline({
        path: [centerPos, currentMarkerPos]
      });

      // 현재 내 위치 기준 드래그한 거리 계산
      if (polyline.getLength() > 50) {
        alert("📍 반경 50m 이내에만 핀을 꽂을 수 있습니다!");
        marker.setPosition(centerPos); // 원위치 복귀
        setSelectedCoords({ lat: currentCoords.lat, lng: currentCoords.lng });
        updateAddress(currentCoords.lng, currentCoords.lat);
      } else {
        setSelectedCoords({ lat: currentMarkerPos.getLat(), lng: currentMarkerPos.getLng() });
        updateAddress(currentMarkerPos.getLng(), currentMarkerPos.getLat());
      }
    });
  };

  // 주소 역지오코딩 변환 함수
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

  // 이미지 선택 핸들러
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file)); // 미리보기 생성
    }
  };

  // 최종 제출 로직 (FormData로 이미지랑 데이터를 통째로 전송)
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoords || !content) return;

    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('place_name', derivedPlaceName);
      formData.append('category', category);
      formData.append('lat', String(selectedCoords.lat));
      formData.append('lng', String(selectedCoords.lng));
      formData.append('user_id', '1');
      if (imageFile) {
        formData.append('image', imageFile); // 파일 첨부
      }

      const response = await fetch('http://127.0.0.1:5000/api/posts', {
        method: 'POST',
        body: formData, // JSON.stringify가 아니라 FormData 바디전송
      });

      if (response.ok) {
        alert('📍 성공적으로 핀과 게시글을 등록했습니다!');
        setContent('');
        setImageFile(null);
        setImagePreview('');
        loadNearbyMarkers();
      } else {
        alert('서버 저장 실패');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="w-screen h-screen flex bg-gray-50 overflow-hidden font-sans">
      <Script
        src="//dapi.kakao.com/v2/maps/sdk.js?appkey=5a9cc8fe6f58844aafaa5b7e9a482c0b&libraries=services&autoload=false"
        strategy="afterInteractive"
        onLoad={() => {
          window.kakao.maps.load(() => {
            initMainMap();
          });
        }}
      />

      {/* 왼쪽 레이아웃: 대폭 바뀐 인스타 스타일 글작성창 + 하단 50m 미니맵 */}
      <section className="w-[420px] h-full bg-white shadow-xl z-10 flex flex-col border-r border-gray-100 overflow-y-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-black text-gray-900 tracking-tight">📝 새 게시글 작성</h2>
          <p className="text-xs text-gray-400 mt-1">인스타 감성으로 동네 소식을 지도에 남겨보세요.</p>
        </div>

        <form onSubmit={handlePostSubmit} className="space-y-5 flex-1 flex flex-col">
          {/* 카테고리 선택 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">카테고리</label>
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            >
              <option value="분실물">🎁 분실물</option>
              <option value="습득물">🔍 습득물</option>
              <option value="자유게시판">💬 자유게시판</option>
              <option value="질문">❓ 질문</option>
            </select>
          </div>

          {/* 텍스트 내용 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">내용 작성</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-gray-800"
              placeholder="여기에 동네 사람들과 공유할 내용을 상세히 적어주세요."
              required
            />
          </div>

          {/* 이미지 업로드 UI 추가 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1.5">📷 현장 사진 첨부</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageChange}
              className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
            {imagePreview && (
              <img src={imagePreview} alt="미리보기" className="mt-3 w-full h-32 object-cover rounded-xl border border-gray-100" />
            )}
          </div>

          {/* 위치 지정 미니맵 (반경 50m 이내 지정) */}
          <div className="flex-1 min-h-[220px] flex flex-col">
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-bold text-gray-500">📍 정확한 위치 지정 (반경 50m 내 드래그)</label>
              <button 
                type="button" 
                onClick={initMiniMap} 
                className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
              >
                미니맵 불러오기
              </button>
            </div>
            
            <div id="mini-map" className="w-full h-full bg-gray-100 rounded-2xl border border-gray-200 shadow-inner relative overflow-hidden" style={{ minHeight: '160px' }}>
              <span className="absolute inset-0 m-auto h-fit w-fit text-xs font-semibold text-gray-400 pointer-events-none">불러오기 버튼을 눌러주세요</span>
            </div>
            <p className="text-[11px] text-indigo-600 font-bold mt-2 bg-indigo-50/50 p-2 rounded-lg">🎯 확정 주소: {derivedPlaceName}</p>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all transform active:scale-95"
          >
            포스트 발행하기 ✨
          </button>
        </form>
      </section>

      {/* 오른쪽 레이아웃: 메인 전체 지도 */}
      <section className="flex-1 h-full relative">
        <div id="main-map" className="w-full h-full" />
      </section>
    </main>
  );
}