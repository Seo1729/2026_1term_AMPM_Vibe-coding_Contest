'use client';
import { useEffect, useState, useRef } from 'react';
import Script from 'next/script';
import Link from 'next/link';

declare global {
  interface Window {
    kakao: any;
  }
}

// 🎯 dc형 익명 댓글 스키마 정의
interface Comment {
  id: number;
  nickname: string;
  passwordHash: string; // 삭제 검증용 비밀번호
  text: string;
}

interface MockPost {
  id: number;
  category: string;
  title: string;
  content: string;
  place_name: string;
  lat: number;
  lng: number;
  is_popular: boolean;
  image_url: string;
  likes: number;     
  comments: Comment[]; // Comment 객체 배열 구조로 고도화
}

export default function Home() {
  // 지도 인스턴스들
  const [mainMap, setMainMap] = useState<any>(null);
  const [miniMap, setMiniMap] = useState<any>(null);
  
  // 왼쪽 창 열림/닫힘 및 모드 제어 (write: 글쓰기, detail: 상세보기)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<'write' | 'detail'>('write'); 
  
  // 우측 상단 카테고리 필터 상태 관리 (기본값: 전체)
  const [activeFilter, setActiveFilter] = useState('전체');
  
  // 위치 관련 상태 (시연의 핵심: 전북대 박물관/대운동장 중심축 고정)
  const [currentCoords, setCurrentCoords] = useState({ lat: 35.8115, lng: 127.1484 });
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lng: number } | null>(null);
  
  // 레퍼런스 제어
  const miniMarkerRef = useRef<any>(null);
  const miniCircleRef = useRef<any>(null);
  const mainMarkersRef = useRef<any[]>([]);
  const myLocationOverlayRef = useRef<any>(null);

  // 게시글 작성 폼 상태
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('분실물');
  const [derivedPlaceName, setDerivedPlaceName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  // 🎯 dc형 댓글 전용 폼 상태
  const [commentNickname, setCommentNickname] = useState('');
  const [commentPassword, setCommentPassword] = useState('');
  const [newCommentText, setNewCommentText] = useState('');

  // 🎯 중복 추천 방지 트래킹용 유저 추천 이력 풀 (메모리형 State)
  const [likedPostIds, setLikedPostIds] = useState<number[]>([]);

  // 선택된 게시글 상세 데이터 관리 상태
  const [selectedPost, setSelectedPost] = useState<MockPost | null>(null);

  // 카테고리 목록 정의
  const categories = ['전체', '분실물', '습득물', '자유게시판', '질문'];

  // 전북대 프리미엄 데이터 11종 (댓글 구조를 익명 시스템 규격으로 완전 치환)
  const [mockupData, setMockupData] = useState<MockPost[]>([
    {
      id: 201,
      category: '분실물',
      title: '진수당 2층 대강당 앞 에어팟 프로 왼쪽 분실',
      content: '오늘 오후 2시쯤 전공 수업 끝나고 나오다가 진수당 계단이나 2층 대강당 복도 쪽에서 떨어뜨린 것 같습니다. 케이스 없이 본체 왼쪽 유닛만 잃어버렸는데, 하단에 살짝 찍힘 자국이 있어요. 주으신 학우분 계시면 제발 댓글이나 연락 부탁드립니다! 커피 기프티콘 드릴게요 ㅠㅠ',
      place_name: '전북대학교 진수당 2층 복도',
      lat: 35.8145,
      lng: 127.1472,
      is_popular: false,
      image_url: 'https://images.unsplash.com/photo-1588444837495-c6cfeb53ca91?w=500&q=80',
      likes: 12,
      comments: [
        { id: 1, nickname: '에어팟구조대', passwordHash: '1234', text: '저 아까 진수당 계단 지나갈 때 본 것 같아요!' },
        { id: 2, nickname: '익명학우', passwordHash: '1111', text: '찾으시길 바랍니다 ㅠㅠ' }
      ]
    },
    {
      id: 202,
      category: '질문',
      title: '🔥 구정문 스벅 골목 늦게까지 배달되는 야식 맛집!',
      content: '지금 AM:PM 동아리원들이랑 공오번 건물에서 밤샘 바이브코딩 대회 준비하느라 다들 영혼까지 털려있습니다... 너무 배고픈데 구정문이나 학도 근처에 지금 배달되거나 새벽 2~3시까지 홀 영업하는 가성비 끝판왕 닭발이나 매콤한 야식집 추천해 주실 분 계신가요?',
      place_name: '전북대 구정문 대학로 번화가 골목',
      lat: 35.8160,
      lng: 127.1438,
      is_popular: true,
      image_url: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=500&q=80',
      likes: 45,
      comments: [
        { id: 1, nickname: '구정문고수', passwordHash: '1234', text: '골목 안쪽 닭발집 새벽 3시까지 해요!' },
        { id: 2, nickname: 'AMPM_팬', passwordHash: '8888', text: '바이브코딩 8조 화이팅!! 우승 가자' }
      ]
    },
    {
      id: 203,
      category: '자유게시판',
      title: '오늘 대운동장 스탠드에서 본 노을 미쳤네요',
      content: '공대 5호관에서 6교시 수업 듣고 터덜터덜 나오는 길에 운동장 쪽 보니까 하늘 핏빛 노을이랑 구름 조합이 완전히 미쳤습니다! 다들 모니터만 보면서 코딩하느라 거북목 되셨을 텐데 잠시 멈추고 하늘 한 번씩 보고 쉬어가세요 ㅎㅎ 다들 화이팅입니다!',
      place_name: '전북대학교 대운동장 관람석 스탠드',
      lat: 35.8110,
      lng: 127.1425,
      is_popular: false,
      image_url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=500&q=80',
      likes: 22,
      comments: [
        { id: 1, nickname: '공대거북이', passwordHash: '1234', text: '우와 진짜 이쁘네요' },
        { id: 2, nickname: '산책러', passwordHash: '0000', text: '저도 실시간으로 봤습니다 대박' }
      ]
    },
    {
      id: 204,
      category: '습득물',
      title: '학습도서관 1층 로비 자판기 옆 검은색 카드지갑 습득',
      content: '방금 학도 1층 로비 음료수 자판기 뽑아 마시다가 밑에 떨어져 있는 메종키츠네 검은색 가죽 카드지갑 주웠습니다. 안에 전북대 학생증이랑 체크카드 들어있는데 성함이 "최세훈" 님으로 되어있네요! 일단 1층 도서관 경비실에 맡겨두었으니 주인분은 얼른 찾아가세요!',
      place_name: '전북대 학습도서관 1층 로비',
      lat: 35.8102,
      lng: 127.1512,
      is_popular: false,
      image_url: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=500&q=80',
      likes: 5,
      comments: [
        { id: 1, nickname: '개발민서', passwordHash: '7777', text: '앗 최세훈 기획자님 지갑 축하드립니다(?)' },
        { id: 2, nickname: '착한학우', passwordHash: '1234', text: '착한 일 하셨네요 추천 꾹!' }
      ]
    },
    {
      id: 205,
      category: '질문',
      title: '중앙도서관 매점 오늘 몇 시까지 하나요?',
      content: '시험기간이라 중도 지하 열람실에서 공부하는 중인데, 졸음도 깰 겸 캔커피랑 삼각김밥 좀 먹으려고 합니다. 혹시 중도 지하 매점이나 편의점 오늘 야간 몇 시까지 운영하는지 아시는 분 답변 좀 부탁드립니다!',
      place_name: '전북대학교 중앙도서관 지하',
      lat: 35.8130,
      lng: 127.1495,
      is_popular: false,
      image_url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=500&q=80',
      likes: 2,
      comments: [
        { id: 1, nickname: '중도요정', passwordHash: '1234', text: '밤 11시까지 영업하는 걸로 알고있어요~' }
      ]
    },
    {
      id: 206,
      category: '자유게시판',
      title: '🔥 제1학생회관 학식 돈까스 비주얼 실화냐',
      content: '오랜만에 일학 학식 먹으러 왔는데 오늘따라 돈까스 크기 엄청나게 크고 소스도 듬뿍 주시네요 ㅋㅋㅋ 역시 가성비는 일학 학식이 최고인 듯합니다. 학우분들 오늘 메뉴 제육이랑 돈까스니까 메뉴 고민 중이시면 일학으로 오세요!!',
      place_name: '전북대 제1학생회관 식당',
      lat: 35.8122,
      lng: 127.1465,
      is_popular: true,
      image_url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&q=80',
      likes: 38,
      comments: [
        { id: 1, nickname: '돈까스빌런', passwordHash: '5555', text: '헐 맛있겠다 오늘 점심은 일학이다' },
        { id: 2, nickname: '학식마스터', passwordHash: '1234', text: '군침 도네요' }
      ]
    },
    {
      id: 207,
      category: '습득물',
      title: '건지광장 분수대 앞 벤치에서 분홍색 우산 보관 중',
      content: '갑자기 소나기 쏟아지다가 그쳤는데, 건지광장 한옥 분수대 앞 나무 벤치에 예쁜 분홍색 투명 우산 장우산 하나가 덩그러니 남겨져 있네요. 주인이 깜빡하고 두고 가신 것 같아서 일단 비 안 맞게 정자 밑 벤치 안쪽으로 옮겨두었습니다. 찾아가셔요~',
      place_name: '전북대학교 건지광장 한옥 분수대',
      lat: 35.8138,
      lng: 127.1478,
      is_popular: false,
      image_url: 'https://images.unsplash.com/photo-1582139329536-e7284fece509?w=500&q=80',
      likes: 4,
      comments: [
        { id: 1, nickname: '분홍우산', passwordHash: '9999', text: '어 제 우산 같은데 확인해 볼게요! 감사합니다!' }
      ]
    },
    {
      id: 208,
      category: '분실물',
      title: '상대 3호관 뒤쪽 흡연부스 근처 갤럭시 버즈 케이스',
      content: '오늘 아침 9시 반쯤 상대 3호관 뒤 편 부스에서 친구랑 얘기하다가 흰색 갤럭시 버즈 프로 본체 케이스(알맹이 포함)를 통째로 흘린 것 같습니다. 흰색 보라색 투톤 실리콘 커버 씌워져 있어요. 혹시 습득하신 분 계시면 댓글 꼭 좀 부탁드립니다!!',
      place_name: '전북대 상과대학 3호관 뒤편',
      lat: 35.8118,
      lng: 127.1520,
      is_popular: false,
      image_url: '',
      likes: 7,
      comments: []
    },
    {
      id: 209,
      category: '자유게시판',
      title: '🔥 박물관 앞 잔디밭 삼색 고양이 근황 ㅋㅋㅋ',
      content: '날씨가 따뜻해서 그런지 전북대 박물관 잔디밭 햇빛 제일 잘 드는 명당 자리에 누워서 발라당 자고 있네요 ㅋㅋ 에브리타임에서 유명한 그 개냥이 맞습니다. 지나가는 학생들 일일이 참견하면서 간식 달라고 애교 부리는데 너무 힐링 되네요.',
      place_name: '전북대학교 박물관 앞 잔디광장',
      lat: 35.8085,
      lng: 127.1490,
      is_popular: true,
      image_url: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=500&q=80',
      likes: 56,
      comments: [
        { id: 1, nickname: '냥이집사', passwordHash: '1234', text: '심장 폭행당함...' },
        { id: 2, nickname: '캣맘', passwordHash: '4321', text: '츄르 준비해서 보러 갑니다.' }
      ]
    },
    {
      id: 210,
      category: '질문',
      title: '공대 7호관 인쇄실 스프링 제본 얼마인가요?',
      content: '이번 학기 전공 PDF 교재 제본하려고 하는데, 공대 7호관 매점 옆 인쇄실에서 대략 300페이지짜리 스프링 제본하면 가격이 얼마나 나올까요? 구정문 복사집까지 나가기 귀찮아서 캠퍼스 안에서 해결하고 싶은데 이용해 보신 분 조언 부탁드립니다!',
      place_name: '전북대학교 공과대학 7호관 인쇄실',
      lat: 35.8100,
      lng: 127.1460,
      is_popular: false,
      image_url: '',
      likes: 1,
      comments: [
        { id: 1, nickname: '제본마스터', passwordHash: '0000', text: '두께 따라 다른데 보통 3천원 안팎이에요.' }
      ]
    },
    {
      id: 211,
      category: '분실물',
      title: '덕진광장 간이정류장 검은색 장지갑 분실',
      content: '금요일 저녁 고향 내려가려고 덕진광장 버스 승차장 의자에서 대기하다가 지갑을 통째로 놔두고 탄 것 같습니다. 검은색 구찌 장지갑이고 지퍼 형태인데, 안에 현금 약간이랑 신분증, 면허증 들어있어요. 혹시 보시거나 인근 지구대에 맡겨주신 분 계시면 후하게 사례하겠습니다.',
      place_name: '덕진광장 시외버스 터미널 승차장',
      lat: 35.8180,
      lng: 127.1420,
      is_popular: false,
      image_url: '',
      likes: 9,
      comments: [
        { id: 1, nickname: '분실수색대', passwordHash: '1234', text: '꼭 찾으시길 기원합니다.' }
      ]
    }
  ]);

  // 내 위치 커스텀 오버레이 구조 HTML
  const getMyLocationContent = () => `
    <div style="position: relative; display: flex; justify-content: center; align-items: center; width: 40px; height: 40px;">
      <div style="
        position: absolute;
        width: 100%;
        height: 100%;
        background-color: rgba(79, 70, 229, 0.3);
        border-radius: 50%;
        animation: pulse 2s infinite;
      "></div>
      <div style="
        position: absolute;
        top: 10px;
        left: 10px;
        width: 20px;
        height: 20px;
        background-color: #4f46e5;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      "></div>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(1.3); opacity: 0; }
      }
    </style>
  `;

  // 1. 메인 지도 초기화
  const initMainMap = () => {
    if (window.kakao && window.kakao.maps) {
      const container = document.getElementById('main-map');
      if (!container) return;

      const options = {
        center: new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng),
        level: 4,
      };
      const map = new window.kakao.maps.Map(container, options);
      setMainMap(map);

      const overlay = new window.kakao.maps.CustomOverlay({
        map: map,
        position: new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng),
        content: getMyLocationContent(),
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 5
      });
      myLocationOverlayRef.current = overlay;
    }
  };

  useEffect(() => {
    if (mainMap) {
      const jbnuPos = new window.kakao.maps.LatLng(35.8115, 127.1484);
      mainMap.setCenter(jbnuPos);
      if (myLocationOverlayRef.current) {
        myLocationOverlayRef.current.setPosition(jbnuPos);
      }
    }
  }, [mainMap]);

  // mockupData 또는 activeFilter가 변경되면 마커 업데이트
  useEffect(() => {
    loadNearbyMarkers();
  }, [mockupData, activeFilter, mainMap]);

  // 🌟 컴포넌트 마운트 시 백엔드에서 저장된 게시글 로드
  useEffect(() => {
    const loadPostsFromBackend = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/api/posts');
        if (response.ok) {
          const posts = await response.json();
          if (posts && posts.length > 0) {
            // 백엔드 데이터를 MockPost 형식으로 변환
            const convertedPosts: MockPost[] = posts.map((post: any) => ({
              id: post.id,
              category: post.category || '기타',
              title: post.title || '제목 없음',
              content: post.content || '',
              place_name: post.place_name || '전북대 캠퍼스',
              lat: post.lat || 35.8115,
              lng: post.lng || 127.1484,
              is_popular: Boolean(post.is_popular),
              image_url: post.image_url || '',
              likes: 0,
              comments: []
            }));
            console.log(`✅ 백엔드에서 ${convertedPosts.length}개 게시글 로드됨`);
            setMockupData(convertedPosts);
          }
        }
      } catch (err) {
        console.warn('⚠️ 백엔드 데이터 로드 실패, 로컬 데이터 사용:', err);
      }
    };

    loadPostsFromBackend();
  }, []); // 초기 마운트 시 한 번만 실행

  // 2. 마커 생성 및 렌더링 (순정 블루 마커)
  const loadNearbyMarkers = () => {
  if (!mainMap) return;

  mainMarkersRef.current.forEach(m => m.setMap(null));
  mainMarkersRef.current = [];

  const categoryColors: Record<string, string> = {
    '분실물':    '#EF4444',
    '습득물':    '#22C55E',
    '자유게시판': '#F59E0B',
    '질문':      '#3B82F6',
  };

  const createSvgMarker = (color: string, isPopular: boolean) => {
    // ⭐ 인기글 전용 별 마커
    const popularSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
        <polygon points="18,2 22,13 34,13 25,20 28,32 18,25 8,32 11,20 2,13 14,13"
          fill="#F59E0B" stroke="white" stroke-width="2"/>
      </svg>
    `;

    // 📍 일반 물방울 마커
    const normalSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
        <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z"
          fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="16" cy="16" r="7" fill="white" opacity="0.9"/>
      </svg>
    `;

    const svg = isPopular ? popularSvg : normalSvg;
    const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

    // ✅ 인기글이면 별 크기에 맞게, 일반이면 핀 크기에 맞게
    const imageSize = isPopular
      ? new window.kakao.maps.Size(36, 36)
      : new window.kakao.maps.Size(32, 40);
    const imageOption = isPopular
      ? { offset: new window.kakao.maps.Point(18, 18) }
      : { offset: new window.kakao.maps.Point(16, 40) };

    return new window.kakao.maps.MarkerImage(encoded, imageSize, imageOption);
  };

  const filteredData = mockupData.filter(post =>
    activeFilter === '전체' ? true : post.category === activeFilter
  );

  const newMarkers: any[] = [];

  filteredData.forEach((post: MockPost) => {
    const markerPosition = new window.kakao.maps.LatLng(post.lat, post.lng);
    const color = categoryColors[post.category] ?? '#6366F1';
    const markerImage = createSvgMarker(color, post.is_popular); // ✅ is_popular 전달

    const marker = new window.kakao.maps.Marker({
      position: markerPosition,
      image: markerImage,
    });

    marker.setMap(mainMap);

    window.kakao.maps.event.addListener(marker, 'click', () => {
      setSelectedPost(post);
      setSidebarMode('detail');
      setIsSidebarOpen(true);
      mainMap.panTo(markerPosition);
    });

    newMarkers.push(marker);
  });

  mainMarkersRef.current = newMarkers;
};


  // 4. 🎯 dc형 익명 댓글 스레드 생성 (닉네임, 비번 연계)
  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !commentNickname.trim() || !commentPassword.trim() || !newCommentText.trim()) return;

    const updatedData = mockupData.map(post => {
      if (post.id === selectedPost.id) {
        const newCommentObj: Comment = {
          id: Date.now(), // 유니크 임시 ID
          nickname: commentNickname.trim(),
          passwordHash: commentPassword.trim(), // 원문 비밀번호 매핑 저장
          text: newCommentText.trim()
        };
        const updatedComments = [...post.comments, newCommentObj];
        setSelectedPost({ ...post, comments: updatedComments });
        return { ...post, comments: updatedComments };
      }
      return post;
    });

    setMockupData(updatedData);
    setCommentNickname('');
    setCommentPassword('');
    setNewCommentText('');
    alert('💬 댓글이 정상 등록되었습니다.');
  };

  // 🎯 dc형 댓글 삭제 관리 기능 (비밀번호 확인 모달 대체 prompt 검증)
  const handleCommentDelete = (commentId: number, originalPasswordHash: string) => {
    const inputPassword = prompt('🔑 댓글 삭제를 위해 설정하신 비밀번호를 입력하세요:');
    
    if (inputPassword === null) return; // 취소 누르면 이탈
    
    if (inputPassword !== originalPasswordHash) {
      alert('❌ 비밀번호가 일치하지 않습니다. 삭제가 거부되었습니다.');
      return;
    }

    // 비밀번호 통과 시 실시간 풀에서 제거 연동
    const updatedData = mockupData.map(post => {
      if (post.id === selectedPost!.id) {
        const filteredComments = post.comments.filter(c => c.id !== commentId);
        setSelectedPost({ ...post, comments: filteredComments });
        return { ...post, comments: filteredComments };
      }
      return post;
    });

    setMockupData(updatedData);
    alert('🗑️ 댓글이 깨끗하게 삭제되었습니다!');
  };

  // 🎯 추천(좋아요) 기능 - 중복 추천 방지
  const handleLikeIncrement = () => {
    if (!selectedPost || likedPostIds.includes(selectedPost.id)) return;

    // 선택된 게시글의 likes 증가
    const updatedPost = { ...selectedPost, likes: selectedPost.likes + 1 };
    
    // 전체 mockupData에서도 업데이트
    const updatedData = mockupData.map(post =>
      post.id === selectedPost.id ? updatedPost : post
    );

    setSelectedPost(updatedPost); // 현재 선택된 게시글 즉시 업데이트
    setMockupData(updatedData); // 전체 데이터 업데이트
    setLikedPostIds([...likedPostIds, selectedPost.id]); // 추천 이력에 추가
    alert('👍 게시글을 추천했습니다!');
  };

  // 5. 미니맵 초기화 및 반경 50m 제한 기능
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
      weight: 2,
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

      // 백엔드 API 호출 시도 (선택사항)
      try {
        const response = await fetch('http://127.0.0.1:5000/api/posts', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          console.warn('⚠️ 백엔드 저장 실패, 로컬 메모리에만 저장합니다');
        }
      } catch (apiErr) {
        console.warn('⚠️ 백엔드 연결 실패, 로컬 메모리에만 저장합니다:', apiErr);
      }

      // 로컬 메모리에 게시글 추가 (백엔드 상태와 무관하게 항상 실행)
      alert('📍 성공적으로 게시글을 발행했습니다!');
      
      const newLocalPost: MockPost = {
        id: mockupData.length + 300,
        category: category,
        title: title,
        content: content,
        place_name: derivedPlaceName || '전북대 교내',
        lat: selectedCoords.lat,
        lng: selectedCoords.lng,
        is_popular: false,
        image_url: imagePreview || '',
        likes: 0,
        comments: []
      };
      setMockupData([newLocalPost, ...mockupData]);
      
      setTitle('');
      setContent('');
      setImageFile(null);
      setImagePreview('');
      setIsSidebarOpen(false); 
      setMiniMap(null);
    } catch (err) {
      console.error('❌ 게시글 작성 중 오류:', err);
      alert('❌ 게시글 작성 중 오류가 발생했습니다.');
    }
  };

  return (
    <main className="w-screen h-screen flex bg-gray-50 overflow-hidden font-sans relative" suppressHydrationWarning>
      <Script
        src="//dapi.kakao.com/v2/maps/sdk.js?appkey=5a9cc8fe6f58844aafaa5b7e9a482c0b&libraries=services&autoload=false"
        strategy="afterInteractive"
        onLoad={() => {
          window.kakao.maps.load(() => {
            initMainMap();
          });
        }}
      />

      {/* 왼쪽 레이아웃 패널 */}
      <section 
        className={`fixed md:relative top-0 left-0 w-[420px] h-full bg-white shadow-2xl z-40 flex flex-col border-r border-gray-100 overflow-y-auto p-6 transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
        style={{ position: isSidebarOpen ? 'relative' : 'absolute' }}
      >
        
        {/* MODE 1: 글쓰기 모드 레이아웃 */}
        {sidebarMode === 'write' ? (
          <>
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

              <div className="flex-1 min-h-[200px] flex flex-col">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-gray-500">📍 위치 지정 (반경 50m 내 드래그)</label>
                  <button 
                    type="button"
                    onClick={initMiniMap} 
                    className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg hover:bg-indigo-100 cursor-pointer"
                  >
                    미니맵 불러오기
                  </button>
                </div>
                
                <div id="mini-map" className="w-full h-full bg-gray-100 rounded-2xl border border-gray-200 shadow-inner relative overflow-hidden" style={{ minHeight: '140px' }}>
                  <span className="absolute inset-0 m-auto h-fit w-fit text-xs font-semibold text-gray-400 pointer-events-none">불러오기 버튼을 눌러주세요</span>
                </div>
                <p className="text-[11px] text-indigo-600 font-bold mt-2 bg-indigo-50/50 p-2 rounded-lg">🎯 확정 주소: {derivedPlaceName}</p>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
              >
                포스트 발행하기 ✨
              </button>
            </form>
          </>
        ) : (
          
          /* MODE 2: 게시글 상세조회 및 추천/댓글 레이아웃 */
          selectedPost && (
            <div className="flex flex-col h-full justify-between">
              <div className="overflow-y-auto pr-1 space-y-4 scrollbar-thin">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block text-xs font-bold text-white px-2.5 py-1 rounded-md bg-indigo-600 mb-2">
                      {selectedPost.category}
                    </span>
                    <h2 className="text-xl font-black text-gray-900 tracking-tight leading-snug">
                      {selectedPost.title}
                    </h2>
                  </div>
                  <button 
                    type="button"
                    onClick={() => { setIsSidebarOpen(false); setSelectedPost(null); }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="text-xs text-gray-500 font-semibold flex items-center space-x-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <span>📍 {selectedPost.place_name}</span>
                </div>

                {selectedPost.image_url && (
                  <div className="w-full h-44 overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
                    <img src={selectedPost.image_url} alt="첨부사진" className="w-full h-full object-cover" />
                  </div>
                )}

                <div className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100 text-sm leading-relaxed text-gray-700 font-medium whitespace-pre-wrap min-h-[100px]">
                  {selectedPost.content}
                </div>

                {/* 🎯 중복 추천 방지 시각화 바인딩 */}
                <div className="flex justify-between items-center bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100">
                  <div className="text-sm font-bold text-indigo-950">
                    👍 이 소식 추천 수: <span className="text-indigo-600 text-base ml-0.5">{selectedPost.likes}</span>개
                  </div>
                  <button
                    type="button"
                    onClick={handleLikeIncrement}
                    disabled={likedPostIds.includes(selectedPost.id)}
                    className={`px-4 py-2 font-bold text-xs rounded-xl shadow-md transition-all flex items-center space-x-1 ${
                      likedPostIds.includes(selectedPost.id)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-95'
                    }`}
                  >
                    <span>▲</span> <span>{likedPostIds.includes(selectedPost.id) ? '추천완료' : '추천하기'}</span>
                  </button>
                </div>

                {/* dc형 댓글 피드 리스트 세션 */}
                <div className="space-y-2.5 pt-2">
                  <h4 className="text-xs font-black text-gray-400 tracking-wider uppercase">💬 댓글 ({selectedPost.comments.length})</h4>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {selectedPost.comments.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4 font-medium">첫 번째 동네 댓글을 남겨보세요!</p>
                    ) : (
                      selectedPost.comments.map((comm) => (
                        <div key={comm.id} className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs font-medium flex flex-col space-y-1 relative group">
                          <div className="flex justify-between items-center text-gray-400 text-[10px] font-bold">
                            <span className="text-indigo-600 font-extrabold">⊙ {comm.nickname}</span>
                            {/* 🎯 dc 감성: 비밀번호 입력 유도형 삭제 단추 */}
                            <button
                              type="button"
                              onClick={() => handleCommentDelete(comm.id, comm.passwordHash)}
                              className="text-red-400 hover:text-red-600 font-medium ml-2 text-[10px]"
                            >
                              삭제 ✕
                            </button>
                          </div>
                          <p className="text-gray-700 font-semibold text-xs leading-relaxed">{comm.text}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* 🎯 dc 감성: 이름 + 비밀번호 + 내용 복합 하단 입력 폼 */}
              <form onSubmit={handleCommentSubmit} className="pt-3 border-t border-gray-100 flex flex-col space-y-2 mt-2 bg-white shrink-0">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={commentNickname}
                    onChange={(e) => setCommentNickname(e.target.value)}
                    placeholder="닉네임"
                    maxLength={10}
                    className="w-1/2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
                    required
                  />
                  <input
                    type="password"
                    value={commentPassword}
                    onChange={(e) => setCommentPassword(e.target.value)}
                    placeholder="비밀번호"
                    maxLength={20}
                    className="w-1/2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-gray-800"
                    required
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={newCommentText}
                    onChange={(e) => setNewCommentText(e.target.value)}
                    placeholder="따뜻한 동네 댓글을 적어주세요..."
                    className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shrink-0 h-[42px]"
                  >
                    등록
                  </button>
                </div>
              </form>
            </div>
          )
        )}
      </section>

      {/* 오른쪽 레이아웃: 메인 전체 지도 영역 */}
      <section className="flex-1 h-full relative">
        <div id="main-map" className="w-full h-full" />

        {/* 우측 상단 카테고리 필터 버튼 그룹 */}
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

        {/* 내 위치 이동 버튼 */}
        <button
          type="button"
          onClick={() => {
            if (mainMap) {
              mainMap.setCenter(new window.kakao.maps.LatLng(currentCoords.lat, currentCoords.lng));
            }
          }}
          className="absolute bottom-10 right-10 z-30 bg-white p-4 rounded-full shadow-lg border border-gray-200 font-bold text-sm text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95"
        >
          내위치
        </button>

        {/* 관리 페이지 버튼 */}
        <Link
          href="/admin"
          className="absolute bottom-10 right-24 z-30 bg-white p-4 rounded-full shadow-lg border border-gray-200 font-bold text-sm text-amber-600 hover:bg-amber-50 transition-all active:scale-95"
          title="글 관리 페이지"
        >
          📋
        </Link>

        {/* 하단 중앙 글쓰기 플로팅 버튼 */}
        <button
          type="button"
          onClick={() => {
            setSidebarMode('write');
            setIsSidebarOpen(true);
          }}
          className="absolute bottom-10 left-1/2 transform -translate-x-1/2 bg-indigo-600 hover:bg-indigo-700 text-white font-black px-8 py-4 rounded-full shadow-2xl z-30 flex items-center space-x-2 text-sm tracking-wide transition-all hover:scale-105 active:scale-95 border-2 border-white/20"
        >
          <span className="text-lg">✏️</span>
          <span>동네 소식 적기</span>
        </button>
      </section>
    </main>
  );
}