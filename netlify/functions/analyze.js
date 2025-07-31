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
        
        const promptText = `너는 스터디 플래너 분석 전문가야. 여러 장의 플래너 사진들을 보고, 다음 정보를 추출해서 JSON 형식으로 반환해줘.

**분석 규칙:**
1.  색칠된 한 칸은 **정확히 10분**으로 계산해.
2.  '파란색=영어', '연두색=과탐', '노란색=수학' 이고, 핑크색은 'STUDY & TODAY' 목록을 보고 국어와 사탐을 구분해줘.

**추출할 정보:**
1.  'daily_summary': 요일별 총 공부 시간을 분 단위로 알려줘. ({"토": 190, "일": 200, ...} 형식)
2.  'subject_summary': 과목별 주간 총 공부 시간을 분 단위로 알려줘. ({"영어": 830, "국어": 300, ...} 형식)
3.  'weekly_summary': **숫자나 통계는 절대 사용하지 말고**, 전체적인 학습 패턴이나 성실도에 대해서만 따뜻하고 친절한 톤으로 2~3 문장의 격려와 칭찬 위주의 총평을 작성해줘.`;
        
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
