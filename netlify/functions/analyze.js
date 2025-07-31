exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { images } = JSON.parse(event.body);
    if (!images || !Array.isArray(images) || images.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ message: 'No images provided.' }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { statusCode: 500, body: JSON.stringify({ message: 'API key is not set on the server.' }) };
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    const promptText = `너는 스터디 플래너 분석 전문가야. 여러 장의 플래너 사진들을 보고, 다음 정보를 추출해서 JSON 형식으로 반환해줘. 가장 중요한 분석 규칙: 시간 계산 (최우선 규칙): 타임 테이블에서 한 줄은 6칸으로 나뉘어져 있고, 총 60분이야. 따라서 색칠된 한 칸은 정확히 10분으로 계산해야 해. 예를 들어 3칸이면 30분, 6칸(한 줄)이면 60분이야. 이 규칙을 반드시 지켜줘. 색깔 규칙: '파란색 🔵 = 영어', '연두색 🟢 = 과탐', '노란색 🟡 = 수학'. 핑크색 🌸 규칙 (국어/사탐 구분): 핑크색은 국어 또는 사탐을 의미해. 반드시 'STUDY & TODAY' 목록에 적힌 글씨를 읽고 국어인지 사탐인지 판단해야 해. 만약 하루에 국어와 사탐이 둘 다 계획되어 있고 핑크색으로 표시되었다면, ✓(체크) 표시가 있는 과목으로 시간을 측정해줘. 만약 둘 다 ✓ 표시가 있다면, 국어로 인식해줘. 추출할 정보: 1. 'daily_summary': 위 규칙에 따라 계산된 요일별 총 공부 시간을 분 단위로 알려줘. (요일 순서: 토,일,월,화,수,목,금) 2. 'subject_summary': 위 규칙에 따라 계산된 과목별 주간 총 공부 시간을 분 단위로 알려줘. 주간 총평 작성: 분석 결과를 바탕으로 'weekly_summary'를 작성해줘. 총평은 아래 예시와 같은 스타일과 형식으로, 문단 사이에 <br><br>을 넣어 가독성을 높이고, 별표 강조 없이 이모티콘을 듬뿍 넣어서 상세하고 따뜻하게 작성해줘. --- 총평 예시: 안녕하세요! ☀️ 이번 주 학생의 학습 플래너를 분석한 리포트입니다.<br><br>이번 한 주간 총 학습 시간은 [총 시간]으로, 하루 평균 약 [평균 시간]씩 꾸준히 학습을 진행하며 매우 성실한 모습을 보여주었어요. 💯 특히 주말에도 쉬지 않고 학습 흐름을 이어간 점이 정말 돋보입니다! 👍<br><br>과목별 학습 시간 분포를 보면 영어([영어 %]) 🔠, 국어([국어 %]) 📚, 과탐([과탐 %]) 🧪, 수학([수학 %]) 🧮, 사탐([사탐 %]) 🌍 주요 과목에 시간을 균형 있게 투자하며 안정적인 학습 패턴을 만들어가고 있어요. 💖<br><br>전반적으로 계획에 따라 성실하게 학습 목표를 달성한, 매우 칭찬할 만한 한 주였습니다. 👏<br><br>다음 주에도 지금처럼 꾸준한 모습을 이어나갈 수 있도록 많은 격려 부탁드립니다! 🔥 ---`;

    try {
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
        const finalData = JSON.parse(result.candidates[0].content.parts[0].text);

        return {
            statusCode: 200,
            body: JSON.stringify(finalData),
        };

    } catch (error) {
        console.error('Server-side error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: error.message }),
        };
    }
};