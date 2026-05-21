'use client';
import { useEffect, useState } from 'react';
import Script from 'next/script';

// 전역에서 kakao를 인식하게 합니다.
declare global {
  interface Window {
    kakao: any;
  }
}

export default function Home() {
  const [isBoardOpen, setIsBoardOpen] = useState(false);
  const [isMailOpen, setIsMailOpen] = useState(false);
  const [mapInstance, setMapInstance] = useState<any>(null);

  // 카카오맵 초기화 함수
  const initMap = () => {
    if (window.kakao && window.kakao.maps) {
      const container = document.getElementById('map');
      const options = {
        // 시드 데이터가 존재하는 전북대 중심 좌표
        center: new window.kakao.maps.LatLng(35.8115, 127.1484),
        level: 4,
      };
      const map = new window.kakao.maps.Map(container, options);
      setMapInstance(map); // 생성된 지도 인스턴스를 상태에 저장
    }
  };

  // 지도가 생성된 후, 백엔드에서 데이터를 받아와 마커를 찍는 이펙트
  useEffect(() => {
    if (!mapInstance) return;

    // 백엔드 API 호출 (전북대 중심 좌표 기준 1km 반경)
    fetch('http://127.0.0.1:5000/api/posts/nearby?lat=35.8115&lng=127.1484&radius=1000')
      .then((res) => res.json())
      .then((data) => {
        if (!Array.isArray(data)) return;

        data.forEach((post: any) => {
          // 1. 마커가 표시될 위치 생성
          const markerPosition = new window.kakao.maps.LatLng(post.lat, post.lng);

          // 2. 마커 생성 (★ MapMarker -> Marker로 오타 수정 완료!)
          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            clickable: true // 마커 클릭 가능하도록 설정
          });

          // 3. 지도 위에 마커 올리기
          marker.setMap(mapInstance);

          // 4. 마커에 풍선 도움말(InfoWindow) 추가하여 글 내용 보여주기
          const iwContent = `
            <div style="padding:10px; font-size:12px; color:#333; text-align:left; min-width:180px; line-height:1.5;">
              <strong style="color:#4f46e5;">[${post.category}]</strong><br/>
              ${post.content}<br/>
              <span style="color:#888; font-size:10px; display:block; margin-top:4px;">📍 ${post.place_name}</span>
            </div>
          `;
          
          const infowindow = new window.kakao.maps.InfoWindow({
            content: iwContent,
            removable: true
          });

          // 마커 클릭 시 정보창 열기 이벤트 등록
          window.kakao.maps.event.addListener(marker, 'click', () => {
            infowindow.open(mapInstance, marker);
          });
        });
      })
      .catch((err) => console.error('❌ 지도 마커 로드 실패:', err));
  }, [mapInstance]);

  return (
    <main className="relative w-screen h-screen overflow-hidden">
      {/* 카카오맵 SDK 로드 */}
      <Script
        src="//dapi.kakao.com/v2/maps/sdk.js?appkey=5a9cc8fe6f58844aafaa5b7e9a482c0b&autoload=false"
        strategy="afterInteractive"
        onLoad={() => {
          if (window.kakao && window.kakao.maps) {
            window.kakao.maps.load(initMap);
          }
        }}
      />

      {/* 지도 영역 */}
      <div id="map" className="w-full h-full absolute inset-0" />

      {/* 하단 버튼 바 */}
      <div className="absolute bottom-10 left-0 w-full px-6 flex justify-between items-center z-10">
        <button
          onClick={() => setIsBoardOpen(true)}
          className="h-14 w-24 bg-white rounded-xl shadow-md border border-gray-300 font-bold"
        >
          게시판
        </button>

        <button className="h-16 w-16 bg-indigo-600 rounded-full text-white text-3xl shadow-lg flex items-center justify-center">
          +
        </button>

        <button
          onClick={() => setIsMailOpen(true)}
          className="h-14 w-24 bg-white rounded-xl shadow-md border border-gray-300 font-bold"
        >
          쪽지함
        </button>
      </div>
    </main>
  );
}