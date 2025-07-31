exports.handler = async function (event) {
    // POST 요청이 아니면 차단
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ message: 'Method Not Allowed' }) };
    }

    try {
        const { images } = JSON.parse(event.body);
        if (!images || !Array.isArray(images) || images.length === 0) {
            return { statusCode: 400, body: JSON.stringify({ message: 'No images provided.' }) };
        }
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return { statusCode: 500, body: JSON.stringify({ message: 'API key is not set on the server.' }) };
        }

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const promptText = `너는 대한민국 최고의 입시 컨설턴트이자 데이터 분석가야. 주어진 스터디 플래너 이미지들을 보고, 아래 규칙과 형식에 맞춰 전문가 수준의 상세하고 깊이 있는 주간 학습 리포트를 생성해줘.

**분석 규칙:**
1.  색칠된 한 칸은 **정확히 10분**으로 계산해야 해.
2.  '파란색=영어', '연두색=과탐', '노란색=수학' 이고, 핑크색은 'STUDY & TODAY' 목록을 보고 국어와 사탐을 구분해야 해.
3.  **가장 중요:** 'weekly_summary'를 작성할 때는, 네가 'subject_summary'에서 직접 계산한 정확한 수치 데이터만을 사용해야 해. 절대로 숫자를 꾸며내거나 틀리게 계산해서는 안 돼.

**추출할 정보 (JSON 형식):**
1.  'daily_summary': 요일별 총 공부 시간을 분 단위로 알려줘. ({"토": 190, "일": 200, ...} 형식)
2.  'subject_summary': 과목별 주간 총 공부 시간을 분 단위로 알려줘. ({"영어": 830, "국어": 300, ...} 형식)
3.  'weekly_summary': 아래의 목차와 질문에 맞춰, 각 항목을 상세하고 구체적으로 분석한 내용을 담은 긴 총평을 작성해줘.

---
**[주간 학습 리포트]**

**1. 총평 개요**
이번 주 총 학습 시간과 하루 평균 학습 시간은 얼마였나요? 전반적인 학습 태도는 어땠나요?
<br><br>
**2. 잘한 점 (칭찬)**
데이터를 분석했을 때, 가장 칭찬해주고 싶은 포인트는 무엇인가요? (예: 특정 요일에 집중력이 높았던 점, 특정 과목에 꾸준히 시간을 투자한 점, 주말에도 쉬지 않은 점 등) 구체적인 수치를 근거로 칭찬해주세요.
<br><br>
**3. 개선할 점 (조언)**
데이터를 분석했을 때, 다음 주에 개선하면 더 좋을 것 같은 아쉬운 점은 무엇인가요? (예: 특정 요일에 학습이 부족했던 점, 과목 간의 학습 불균형, 주말 학습 시간 부족 등) 감정적인 비난이 아닌, 데이터에 기반한 건설적인 피드백을 주세요.
<br><br>
**4. 다음 주를 위한 구체적인 조언**
위에서 지적한 개선점을 바탕으로, 다음 주에 실천할 수 있는 구체적인 행동 계획을 1~2가지 제안해주세요. (예: "주말 오전에 최소 2시간은 집중 학습 시간으로 확보해보세요", "수학 과목의 비중을 20%까지 늘리기 위해 매일 저녁 30분씩 추가 학습을 권장합니다.")
<br><br>
항상 응원하고 있습니다. 다음 주에는 더 성장한 모습으로 만나요! 🔥
---`;
        
        const parts = [{ text: promptText }];
        images.forEach(imgData => parts.push({ inlineData: { mimeType: "image/jpeg", data: imgData } }));

        const payload = {
            contents: [{ parts }],
            generationConfig: {
                responseMimeType: "application/json",
            }
        };
        
        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error('Google API Error:', errorBody);
            return { statusCode: geminiResponse.status, body: JSON.stringify({ message: `Google API 서버 오류: ${geminiResponse.statusText}` }) };
        }

        const result = await geminiResponse.json();
        
        // ★★★ 안정성 강화 시작 ★★★
        // AI가 보낸 응답이 유효한지 확인하고 로그를 남깁니다.
        if (!result.candidates || !result.candidates[0] || !result.candidates[0].content || !result.candidates[0].content.parts[0]) {
            console.error('Unexpected response structure from Google AI:', JSON.stringify(result, null, 2));
            return { statusCode: 500, body: JSON.stringify({ message: 'AI로부터 예상치 못한 형식의 응답을 받았습니다.' }) };
        }

        const aiResponseText = result.candidates[0].content.parts[0].text;
        
        // Netlify 로그에 AI가 보낸 원본 텍스트를 출력합니다. (디버깅에 중요!)
        console.log("AI 응답 원본:", aiResponseText);

        try {
            // AI가 보낸 텍스트를 JSON으로 파싱 시도
            const finalData = JSON.parse(aiResponseText);
            return {
                statusCode: 200,
                body: JSON.stringify(finalData),
            };
        } catch (parseError) {
            console.error('Failed to parse AI response as JSON:', parseError);
            // JSON 변환에 실패하면, AI가 보낸 원본 텍-스트를 에러 메시지로 전달
            return { statusCode: 500, body: JSON.stringify({ message: `AI 응답을 JSON으로 변환하는 데 실패했습니다. AI 응답: ${aiResponseText}` }) };
        }
        // ★★★ 안정성 강화 끝 ★★★

    } catch (error) {
        console.error('Server-side error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message }),
        };
    }
};
