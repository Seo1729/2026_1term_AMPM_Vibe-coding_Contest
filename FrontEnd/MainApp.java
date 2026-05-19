import java.awt.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import javax.swing.*;

public class MainApp {
    // ⚠️ 리더님의 실제 파이썬 Flask 서버 IP 주소를 적어주세요.
    private static final String SERVER_URL = "http://192.168.55.191:5000/api/posts/nearby";

    public static void main(String[] args) {
        // 1. 전체 프레임 설정 (포켓몬고 느낌의 세로형 모바일 비율 창)
        JFrame frame = new JFrame("🗺️ VIBE GO (포켓몬고 스타일)");
        frame.setSize(450, 700);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setLayout(new BorderLayout());

        // --- [상단 영역] 가상 GPS 입력 및 레이더 컨트롤 ---
        JPanel topPanel = new JPanel(new GridLayout(2, 1));
        topPanel.setBackground(new Color(35, 45, 60)); // 다크 포켓몬 스타일 고유색

        // GPS 입력창 레이아웃
        JPanel gpsPanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        gpsPanel.setOpaque(false);
        JLabel lblGps = new JLabel("📍 내 좌표 입력 ->  위도:");
        lblGps.setForeground(Color.WHITE);
        JTextField latField = new JTextField("35.8115", 5);
        JLabel lblLng = new JLabel("경도:");
        lblLng.setForeground(Color.WHITE);
        JTextField lngField = new JTextField("127.1484", 6);
        gpsPanel.add(lblGps);
        gpsPanel.add(latField);
        gpsPanel.add(lblLng);
        gpsPanel.add(lngField);

        // 반경 슬라이더 (포켓몬고 몬스터 감지 반경 조절 느낌)
        JPanel radiusPanel = new JPanel(new FlowLayout(FlowLayout.CENTER));
        radiusPanel.setOpaque(false);
        JLabel lblRadius = new JLabel("📡 감지 반경: 300m");
        lblRadius.setForeground(Color.WHITE);
        radiusPanel.add(lblRadius);

        topPanel.add(gpsPanel);
        topPanel.add(radiusPanel);
        frame.add(topPanel, BorderLayout.NORTH);


        // --- [중앙 영역] 포켓몬고 스타일의 레이더 및 트레이너 맵 배경 ---
        JPanel centerMapPanel = new JPanel() {
            @Override
            protected void paintComponent(Graphics g) {
                super.paintComponent(g);
                Graphics2D g2 = (Graphics2D) g;
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

                // 연한 녹색/푸른색의 포켓몬고 필드 배경색
                g2.setColor(new Color(140, 210, 150)); 
                g2.fillRect(0, 0, getWidth(), getHeight());

                int centerX = getWidth() / 2;
                int centerY = getHeight() / 2;

                // 몬스터 탐지 레이더 동심원 그리기 (포켓몬고 시그니처 링)
                g2.setColor(new Color(255, 255, 255, 80));
                g2.drawOval(centerX - 120, centerY - 120, 240, 240);
                g2.setColor(new Color(255, 255, 255, 140));
                g2.drawOval(centerX - 60, centerY - 60, 120, 120);

                // 센터 트레이너 위치 표시 (빨간 핀)
                g2.setColor(Color.RED);
                g2.fillOval(centerX - 8, centerY - 8, 16, 16);
                g2.setColor(Color.WHITE);
                g2.drawOval(centerX - 8, centerY - 8, 16, 16);
                
                g2.setColor(new Color(30, 30, 30));
                g2.setFont(new Font("맑은 고딕", Font.BOLD, 12));
                g2.drawString("🙋‍♂️ 내 트레이너 위치", centerX - 50, centerY - 15);
            }
        };
        frame.add(centerMapPanel, BorderLayout.CENTER);


        // --- [하단 영역] "내 주변에 나타난 포켓몬(게시글) 목록" ---
        JPanel bottomPanel = new JPanel(new BorderLayout());
        bottomPanel.setPreferredSize(new Dimension(450, 280));
        bottomPanel.setBorder(BorderFactory.createTitledBorder(
                BorderFactory.createLineBorder(new Color(70, 130, 180), 2), 
                "🐾 내 주변에 나타난 바이브(포켓몬) 목록", 0, 0, 
                new Font("맑은 고딕", Font.BOLD, 14), new Color(25, 25, 112))
        );

        // 실제 리스트 뷰 및 스크롤바 세팅
        DefaultListModel<String> listModel = new DefaultListModel<>();
        JList<String> pokemonList = new JList<>(listModel);
        pokemonList.setFont(new Font("맑은 고딕", Font.PLAIN, 13));
        pokemonList.setBackground(new Color(245, 245, 250)); // 깔끔한 화이트그레이 배경
        JScrollPane scrollPane = new JScrollPane(pokemonList);
        bottomPanel.add(scrollPane, BorderLayout.CENTER);

        // 하단에 배치될 커다란 "몬스터볼 모양 탐색 버튼"
        JButton btnScan = new JButton("🔴 주변 포켓몬(게시글) 서치 시작!");
        btnScan.setFont(new Font("맑은 고딕", Font.BOLD, 14));
        btnScan.setBackground(new Color(220, 50, 50));
        btnScan.setForeground(Color.WHITE);
        btnScan.setFocusPainted(false);
        bottomPanel.add(btnScan, BorderLayout.SOUTH);

        frame.add(bottomPanel, BorderLayout.SOUTH);

        // --- [이벤트 로직] 버튼을 누르면 파이썬 Flask + PostGIS 서버 통신 ---
        btnScan.addActionListener(e -> {
            listModel.clear();
            listModel.addElement("📡 PostGIS 레이더 가동 중... 주변 데이터를 스캔합니다.");

            new Thread(() -> {
                try {
                    // 입력한 위도, 경도 기반 쿼리 주소 생성 (기본 반경 300m 고정)
                    String urlStr = String.format("%s?lat=%s&lng=%s&radius=300",
                            SERVER_URL, latField.getText(), lngField.getText());
                    
                    URL url = new URL(urlStr);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");

                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream(), "UTF-8"));
                    StringBuilder jsonResponse = new StringBuilder();
                    String line;
                    while ((line = in.readLine()) != null) {
                        jsonResponse.append(line);
                    }
                    in.close();

                    // 거품 없는 순수 JSON 파싱 메서드 호출
                    List<PostData> posts = parseJson(jsonResponse.toString());

                    // UI 화면 업데이트
                    SwingUtilities.invokeLater(() -> {
                        listModel.clear();
                        if (posts.isEmpty()) {
                            listModel.addElement("📭 이 지역에는 나타난 포켓몬(게시글)이 없습니다.");
                        } else {
                            for (PostData post : posts) {
                                listModel.addElement(post.toPokemonString());
                                listModel.addElement("---------------------------------------------------------------------------------");
                            }
                        }
                    });

                } catch (Exception ex) {
                    SwingUtilities.invokeLater(() -> {
                        listModel.clear();
                        listModel.addElement("❌ 로컬 Flask 서버가 꺼져 있습니다: " + ex.getMessage());
                    });
                }
            }).start();
        });

        // 화면 중앙 배치 및 활성화
        frame.setLocationRelativeTo(null);
        frame.setVisible(true);
    }

    // --- [내부 클래스] 외부 파일 분리를 막기 위해 내장한 담백한 데이터 구조체 ---
    static class PostData {
        public int id;
        public String content;
        public String place_name;
        public String category;
        public double distance;

        // 포켓몬 고 스타일에 특화된 텍스트 변환 포맷
        public String toPokemonString() {
            String emoji = "✨";
            if (category.equals("분실물")) emoji = "🎒";
            else if (category.equals("일상")) emoji = "💬";
            else if (category.equals("이벤트")) emoji = "🔥";

            return String.format(" %s [%s] %s  |  📍 거리: %d 미터 앞 출현!", 
                    emoji, category, place_name, (int)distance);
        }
    }

    // --- [내부 메서드] 1개 파일 구동을 위한 순수 자바 파서 ---
    private static List<PostData> parseJson(String json) {
        List<PostData> list = new ArrayList<>();
        json = json.trim();
        if (!json.startsWith("[") || json.equals("[]")) return list;

        json = json.substring(1, json.length() - 1);
        String[] objects = json.split("\\},\\{");

        for (String obj : objects) {
            obj = obj.replace("{", "").replace("}", "");
            PostData post = new PostData();
            String[] pairs = obj.split(",");
            
            for (String pair : pairs) {
                String[] keyValue = pair.split(":");
                if (keyValue.length < 2) continue;
                String key = keyValue[0].trim().replace("\"", "");
                String value = keyValue[1].trim().replace("\"", "");

                if (key.equals("id")) post.id = Integer.parseInt(value);
                else if (key.equals("content")) post.content = value;
                else if (key.equals("place_name")) post.place_name = value;
                else if (key.equals("category")) post.category = value;
                else if (key.equals("distance")) post.distance = Double.parseDouble(value);
            }
            list.add(post);
        }
        return list;
    }
}
