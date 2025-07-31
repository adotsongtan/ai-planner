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
        
        const promptText = const promptText = `너는 스터디 플래너 분석 전문가야. 여러 장의 플래너 사진들을 보고, 다음 정보를 추출해서 JSON 형식으로 반환해줘.

**가장 중요한 분석 규칙:**
1.  **시간 계산 (최우선 규칙):** 타임 테이블에서 색칠된 **한 칸은 정확히 10분**으로 계산해야 해.
2.  **색깔 규칙:** '파란색 🔵 = 영어', '연두색 🟢 = 과탐', '노란색 🟡 = 수학'.
3.  **핑크색 🌸 규칙 (국어/사탐 구분):** 'STUDY & TODAY' 목록을 참고해서 국어와 사탐을 구분해줘.

**추출할 정보:**
1.  'daily_summary': 요일별 총 공부 시간을 분 단위로 알려줘. ({"토": 190, "일": 200, ...} 형식)
2.  'subject_summary': 과목별 주간 총 공부 시간을 분 단위로 알려줘. ({"영어": 830, "국어": 300, ...} 형식)
3.  'weekly_summary': **아래 총평 템플릿의 대괄호([]) 안 내용을 채우지 말고, [PLACEHOLDER] 형식 그대로 반환해줘. 절대로 숫자를 직접 계산해서 넣지 마.**

---
총평 템플릿:
안녕하세요! ☀️ 이번 주 학생의 학습 플래너를 분석한 리포트입니다.<br><br>이번 한 주간 총 학습 시간은 [TOTAL_TIME]분으로, 하루 평균 약 [AVG_TIME]분씩 꾸준히 학습을 진행하며 매우 성실한 모습을 보여주었어요. 💯 특히 주말에도 쉬지 않고 학습 흐름을 이어간 점이 정말 돋보입니다! 👍<br><br>과목별 학습 시간 분포를 보면 [SUBJECT_DETAILS] 주요 과목에 시간을 균형 있게 투자하며 안정적인 학습 패턴을 만들어가고 있어요. 💖<br><br>전반적으로 계획에 따라 성실하게 학습 목표를 달성한, 매우 칭찬할 만한 한 주였습니다. 👏<br><br>다음 주에도 지금처럼 꾸준한 모습을 이어나갈 수 있도록 많은 격려 부탁드립니다! 🔥
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
