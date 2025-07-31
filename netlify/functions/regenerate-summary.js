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

        // AI에게 전달할 핵심 데이터 요약
        const totalMinutes = Object.values(correctedData.subject_summary).reduce((sum, time) => sum + time, 0);
        const dailyCount = Object.keys(correctedData.daily_summary).length;
        const avgMinutes = dailyCount > 0 ? Math.round(totalMinutes / dailyCount) : 0;

        const summaryPrompt = `
너는 학생의 마음을 잘 이해하는 따뜻한 학습 멘토야.
아래의 핵심 데이터를 바탕으로, 학생을 격려하고 구체적인 조언을 해주는 상세한 주간 총평을 자연스러운 문체로 작성해줘.

[핵심 학습 데이터]
- 주간 총 학습 시간: ${totalMinutes}분
- 하루 평균 학습 시간: 약 ${avgMinutes}분
- 과목별 학습 시간(분): ${JSON.stringify(correctedData.subject_summary)}
- 요일별 학습 시간(분): ${JSON.stringify(correctedData.daily_summary)}

[총평 작성 가이드라인]
1.  위에 제공된 핵심 데이터를 자연스럽게 문장에 녹여서 설명해줘.
2.  잘한 점과 개선할 점을 구체적으로 언급해줘.
3.  다음 주를 위한 실천 가능한 조언을 1~2가지 제안해줘.
4.  전체적으로 매우 따뜻하고, 학생을 진심으로 응원하는 톤을 유지해줘.
5.  문단 사이에는 <br><br>을 넣어 가독성을 높여줘.
`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
        
        const payload = {
            contents: [{ parts: [{ text: summaryPrompt }] }],
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
