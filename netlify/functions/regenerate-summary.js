exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const correctedData = JSON.parse(event.body);
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return { statusCode: 500, body: JSON.stringify({ message: 'API key is not set on the server.' }) };
        }

        // AI에게 수정된 데이터를 보여주고, 총평만 다시 작성하도록 요청하는 프롬프트
        const promptText = `
너는 대한민국 최고의 입시 컨설턴트이자 데이터 분석가야.
아래에 있는 확정된 주간 학습 데이터를 보고, 이 데이터를 기반으로 전문가 수준의 상세하고 깊이 있는 주간 학습 리포트 총평만을 작성해줘.

**[확정된 주간 학습 데이터]**
${JSON.stringify(correctedData, null, 2)}

**[총평 작성 가이드라인]**
1.  **반드시 위에 제공된 [확정된 주간 학습 데이터]의 수치만을 사용해서** 총평을 작성해야 해. 절대로 숫자를 꾸며내거나 틀리게 계산해서는 안 돼.
2.  아래 목차와 질문에 맞춰, 각 항목을 상세하고 구체적으로 분석한 내용을 담은 긴 총평을 작성해줘.
---
**[주간 학습 리포트]**

**1. 총평 개요**
이번 주 총 학습 시간과 하루 평균 학습 시간은 얼마였나요? 전반적인 학습 태도는 어땠나요?
<br><br>
**2. 잘한 점 (칭찬)**
데이터를 분석했을 때, 가장 칭찬해주고 싶은 포인트는 무엇인가요?
<br><br>
**3. 개선할 점 (조언)**
데이터를 분석했을 때, 다음 주에 개선하면 더 좋을 것 같은 아쉬운 점은 무엇인가요?
<br><br>
**4. 다음 주를 위한 구체적인 조언**
위에서 지적한 개선점을 바탕으로, 다음 주에 실천할 수 있는 구체적인 행동 계획을 1~2가지 제안해주세요.
<br><br>
항상 응원하고 있습니다. 다음 주에는 더 성장한 모습으로 만나요! 🔥
---
`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: promptText }] }],
        };

        const geminiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            throw new Error(`Google API responded with status: ${geminiResponse.status}`);
        }

        const result = await geminiResponse.json();
        const newSummary = result.candidates[0].content.parts[0].text;

        return {
            statusCode: 200,
            body: JSON.stringify({ weekly_summary: newSummary }),
        };

    } catch (error) {
        console.error('Error regenerating summary:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ message: '총평을 다시 생성하는 중 오류가 발생했습니다.' }),
        };
    }
};
