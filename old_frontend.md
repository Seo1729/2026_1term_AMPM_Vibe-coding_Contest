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

  const initMap = () => {
    if (window.kakao && window.kakao.maps) {
      const container = document.getElementById('map');
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 3,
      };
      new window.kakao.maps.Map(container, options);
    }
  };

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