'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    kakao: any;
  }
}

export default function Home() {
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  
  // 입력 폼 제어 모달 상태 관리
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [clickCoords, setClickCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [derivedPlaceName, setDerivedPlaceName] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('분실물');

  // 카카오맵 맵 초기화
  const initMap = () => {
    if (window.kakao && window.kakao.maps) {
      const container = document.getElementById('map');
      const options = {
        center: new window.kakao.maps.LatLng(35.8115, 127.1484), // 전북대 중심
        level: 4,
      };
      const map = new window.kakao.maps.Map(container, options);
      setMapInstance(map);
    }
  };

  // 서버로부터 핀 리스트를 땡겨와 마커로 맵핑하는 로직
  const loadNearbyMarkers = () => {
    if (!mapInstance) return;

    // 기존 마커 싹 지우고 초기화
    markers.forEach(m => m.setMap(null));
    setMarkers([]);

    fetch('http://127.0.0.1:5000/api/posts/nearby?lat=35.8115&lng=127.1484&radius=1500')
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;

        const newMarkers: any[] = [];

        data.forEach((post: any) => {
          const markerPosition = new window.kakao.maps.LatLng(post.lat, post.lng);
          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
          });

          marker.setMap(mapInstance);

          const iwContent = `
            <div style="padding:10px; font-size:12px; color:#333; width:200px; line-height:1.4;">
              <b style="color:#4f46e5;">[${post.category}]</b> ${post.place_name}<br/>
              <p style="margin-top:4px; font-weight:500;">${post.content}</p>
            </div>
          `;
          const infowindow = new window.kakao.maps.InfoWindow({
            content: iwContent,
            removable: true
          });

          window.kakao.maps.event.addListener(marker, 'click', () => {
            infowindow.open(mapInstance, marker);
          });

          newMarkers.push(marker);
        });

        setMarkers(newMarkers);
      })
      .catch((err) => console.error('마커 로딩 실패:', err));
  };

  // 지도 클릭 핸들러 및 위치값 추정/보정 (역지오코딩 연동)
  useEffect(() => {
    if (!mapInstance) return;

    // 카카오맵 클릭 이벤트 등록
    window.kakao.maps.event.addListener(mapInstance, 'click', function (mouseEvent: any) {
      const latlng = mouseEvent.latLng;
      const clickedLat = latlng.getLat();
      const clickedLng = latlng.getLng();

      setClickCoords({ lat: clickedLat, lng: clickedLng });

      // 카카오 내장 주소-좌표 변환 객체 생성 (위치 보정용 벡터 추정)
      const geocoder = new window.kakao.maps.services.Geocoder();
      
      geocoder.coord2Address(clickedLng, clickedLat, function (result: any, status: any) {
        if (status === window.kakao.maps.services.Status.OK) {
          // 건물명이 잡히면 건물명으로 보정, 없으면 지번/도로명 주소로 보정
          const buildingName = result[0].road_address?.building_name;
          const addressName = result[0].address.address_name;
          setDerivedPlaceName(buildingName ? `전북대 ${buildingName}` : addressName);
        } else {
          setDerivedPlaceName('전북대 캠퍼스 내부');
        }
        // 작성 창 활성화
        setIsWriteModalOpen(true);
      });
    });

    loadNearbyMarkers();
  }, [mapInstance]);

  // 사용자가 핀 정보 다 적고 저장 버튼 눌렀을 때 백엔드로 저장하는 핸들러
  const handlePostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickCoords || !content) return;

    try {
      const response = await fetch('http://127.0.0.1:5000/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          place_name: derivedPlaceName,
          category,
          lat: clickCoords.lat,
          lng: clickCoords.lng,
          user_id: 1,
        }),
      });

      if (response.ok) {
        alert('📍 지도 위에 성공적으로 핀을 생성했습니다!');
        setIsWriteModalOpen(false);
        setContent('');
        // 등록 직후 맵에 마커 새로고침 갱신
        loadNearbyMarkers();
      } else {
        alert('서버 저장 실패');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-gray-100">
      {/* 카카오맵 지도 및 주소 라이브러리(services) 포함 로드 */}
      <Script
        src="//dapi.kakao.com/v2/maps/sdk.js?appkey=5a9cc8fe6f58844aafaa5b7e9a482c0b&libraries=services&autoload=false"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.kakao && window.kakao.maps) {
            window.kakao.maps.load(initMap);
          }
        }}
      />

      {/* 지도 영역 */}
      <div id="map" className="w-full h-full absolute inset-0" />

      {/* 팝업 방식의 글 작성 모달 인터페이스 */}
      {isWriteModalOpen && (
        <div className="absolute top-5 left-1/2 transform -translate-x-1/2 w-11/12 max-w-md bg-white p-5 rounded-2xl shadow-2xl z-50 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-800 mb-2">📍 여기에 새 핀 꼽기</h3>
          <p className="text-xs text-indigo-600 font-semibold mb-4">추정 보정 위치: {derivedPlaceName}</p>
          
          <form onSubmit={handlePostSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">카테고리</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-xl text-sm"
              >
                <option value="분실물">🎁 분실물</option>
                <option value="습득물">🔍 습득물</option>
                <option value="자유게시판">💬 자유게시판</option>
                <option value="질문">❓ 질문</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">글 내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="핀 내부에 들어갈 상세 내용을 적어주세요."
                className="w-full p-3 border border-gray-300 rounded-xl text-sm h-24 resize-none"
                required
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsWriteModalOpen(false)}
                className="w-1/3 py-2.5 bg-gray-200 text-gray-700 text-sm font-bold rounded-xl"
              >
                취소
              </button>
              <button
                type="submit"
                className="w-2/3 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-md"
              >
                핀 생성하기
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}