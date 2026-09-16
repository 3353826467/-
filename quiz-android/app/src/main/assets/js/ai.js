const AiService = (function() {
    function getSettings() {
        return Storage.getSettings();
    }

    function isConfigured() {
        const settings = getSettings();
        return !!(settings.aiEnabled && settings.aiApiKey && settings.aiBaseUrl && settings.aiModel);
    }

    function getEndpoint() {
        const settings = getSettings();
        return settings.aiBaseUrl.replace(/\/$/, '') + '/chat/completions';
    }

    async function chat(messages, options) {
        const settings = getSettings();
        if (!settings.aiEnabled) {
            throw new Error('请先在设置中开启 AI 功能');
        }
        if (!settings.aiApiKey) {
            throw new Error('请先在设置中填写 AI API Key');
        }
        if (!settings.aiBaseUrl) {
            throw new Error('请先在设置中填写 AI Base URL');
        }
        if (!settings.aiModel) {
            throw new Error('请先在设置中填写 AI 模型');
        }

        const body = {
            model: settings.aiModel,
            temperature: options && typeof options.temperature === 'number' ? options.temperature : 0.2,
            messages
        };

        let response;
        try {
            response = await fetch(getEndpoint(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + settings.aiApiKey
                },
                body: JSON.stringify(body)
            });
        } catch (error) {
            const reason = error && error.message ? error.message : 'Failed to fetch';
            throw new Error('AI 网络请求失败，请检查 Base URL、API Key、当前网络，或重新编译安卓应用后再试：' + reason);
        }

        if (!response.ok) {
            const text = await response.text();
            throw new Error('AI 请求失败：' + response.status + ' ' + text.slice(0, 200));
        }

        const data = await response.json();
        const content = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';

        if (!content) {
            throw new Error('AI 未返回有效内容');
        }

        return content;
    }

    function extractJson(text) {
        const cleaned = String(text || '').replace(/^\uFEFF/, '').trim();
        if (!cleaned) throw new Error('AI 返回为空');

        const candidates = [];
        const pushCandidate = (value) => {
            const normalized = String(value || '').trim();
            if (normalized && !candidates.includes(normalized)) {
                candidates.push(normalized);
            }
        };

        pushCandidate(cleaned);

        const fencedMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fencedMatch) {
            pushCandidate(fencedMatch[1]);
        }

        const startObj = cleaned.indexOf('{');
        const endObj = cleaned.lastIndexOf('}');
        if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
            pushCandidate(cleaned.slice(startObj, endObj + 1));
        }

        const startArr = cleaned.indexOf('[');
        const endArr = cleaned.lastIndexOf(']');
        if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
            pushCandidate(cleaned.slice(startArr, endArr + 1));
        }

        for (const candidate of candidates) {
            const parsed = tryParseJsonCandidate(candidate);
            if (parsed !== null) {
                return parsed;
            }
        }

        throw new Error('AI 返回了不规范的 JSON，请重试一次，或切换更稳定的模型');
    }

    function tryParseJsonCandidate(candidate) {
        const attempts = [
            candidate,
            repairJsonText(candidate)
        ];

        for (const attempt of attempts) {
            try {
                return JSON.parse(attempt);
            } catch (_) {}
        }

        return null;
    }

    function repairJsonText(input) {
        const text = String(input || '')
            .replace(/[“”]/g, '"')
            .replace(/[‘’]/g, "'")
            .replace(/\t/g, '    ');

        let result = '';
        let inString = false;
        let escaped = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (inString) {
                if (escaped) {
                    result += ch;
                    escaped = false;
                    continue;
                }

                if (ch === '\\') {
                    result += ch;
                    escaped = true;
                    continue;
                }

                if (ch === '"') {
                    const next = getNextSignificantChar(text, i + 1);
                    if (next && ![',', '}', ']', ':'].includes(next)) {
                        result += '\\"';
                        continue;
                    }
                    inString = false;
                    result += ch;
                    continue;
                }

                if (ch === '\n' || ch === '\r') {
                    result += '\\n';
                    continue;
                }

                result += ch;
                continue;
            }

            if (ch === '"') {
                inString = true;
            }
            result += ch;
        }

        return result.replace(/,\s*([}\]])/g, '$1');
    }

    function getNextSignificantChar(text, startIndex) {
        for (let i = startIndex; i < text.length; i++) {
            const ch = text[i];
            if (!/\s/.test(ch)) {
                return ch;
            }
        }
        return '';
    }

    function normalizeQuestion(question) {
        const q = Object.assign({
            type: 'single',
            content: '',
            options: [],
            answer: '',
            explanation: ''
        }, question || {});

        q.type = ['single', 'multiple', 'truefalse', 'fillblank', 'shortanswer'].includes(q.type)
            ? q.type
            : 'single';
        q.content = String(q.content || '').trim();
        q.options = Array.isArray(q.options) ? q.options.map(item => String(item || '').trim()).filter(Boolean) : [];
        q.answer = String(q.answer || '').trim();
        q.explanation = String(q.explanation || '').trim();
        return q;
    }

    async function parseQuestionsFromText(rawText) {
        const prompt = [
            '你是一个严格的题库整理助手。',
            '请从原始文本中识别题目，并整理为标准 JSON。',
            '要求：',
            '1. 仅返回 JSON，不要输出任何解释。',
            '2. JSON 格式为：{"questions":[{"type":"single|multiple|truefalse|fillblank|shortanswer","content":"题目","options":["选项A"],"answer":"答案","explanation":"解析"}]}',
            '3. 自动识别题型。',
            '4. 如果是选择题，options 必须是纯选项文本，不带 A/B/C/D 前缀。',
            '5. 如果原文没有解析，explanation 设为空字符串。',
            '6. 尽量修正错乱排版和换行。',
            '7. 所有字符串中的双引号必须转义，不要输出不完整 JSON。',
            '8. 不要输出 markdown 说明，不要省略逗号或括号。',
            '',
            '原始文本如下：',
            rawText
        ].join('\n');

        const content = await chat([
            { role: 'system', content: '你是题库结构化助手。' },
            { role: 'user', content: prompt }
        ], { temperature: 0.1 });

        const json = extractJson(content);
        if (!json.questions || !Array.isArray(json.questions)) {
            throw new Error('AI 未返回 questions 数组');
        }

        return json.questions.map(normalizeQuestion).filter(q => q.content && q.answer);
    }

    async function generateExplanation(question) {
        const content = await chat([
            {
                role: 'system',
                content: '你是刷题应用里的讲题老师，请输出简洁、准确、利于记忆的解析。'
            },
            {
                role: 'user',
                content: [
                    '请为下面这道题生成解析。',
                    '返回 JSON：{"explanation":"..."}',
                    '题型：' + Storage.getQuestionTypeName(question.type),
                    '题目：' + question.content,
                    question.options && question.options.length ? ('选项：\n' + question.options.map((o, i) => String.fromCharCode(65 + i) + '. ' + o).join('\n')) : '',
                    '答案：' + question.answer
                ].filter(Boolean).join('\n')
            }
        ], { temperature: 0.4 });

        const json = extractJson(content);
        if (!json.explanation) {
            throw new Error('AI 未返回解析内容');
        }
        return String(json.explanation).trim();
    }

    async function testConnection() {
        const content = await chat([
            { role: 'system', content: '你是接口连通性测试助手。' },
            { role: 'user', content: '请返回 JSON：{"ok":true,"message":"..."}，message 中简短说明当前模型可用。' }
        ], { temperature: 0 });

        const json = extractJson(content);
        return {
            ok: !!json.ok,
            message: String(json.message || 'AI 接口可用').trim()
        };
    }

    async function gradeSubjectiveAnswer(question, userAnswer) {
        const content = await chat([
            {
                role: 'system',
                content: '你是刷题判题助手。请根据参考答案、题目和用户答案，判断是否应判对，并给出简短理由。'
            },
            {
                role: 'user',
                content: [
                    '请返回 JSON：{"correct":true,"score":1,"reason":"..."}',
                    'score 取 0 到 1。',
                    '如果用户答案与参考答案语义等价、关键点完整，可判 correct=true。',
                    '题型：' + Storage.getQuestionTypeName(question.type),
                    '题目：' + question.content,
                    question.options && question.options.length ? ('选项：\n' + question.options.map((o, i) => String.fromCharCode(65 + i) + '. ' + o).join('\n')) : '',
                    '参考答案：' + question.answer,
                    question.explanation ? ('解析：' + question.explanation) : '',
                    '用户答案：' + userAnswer
                ].filter(Boolean).join('\n')
            }
        ], { temperature: 0.1 });

        const json = extractJson(content);
        return {
            correct: !!json.correct,
            score: typeof json.score === 'number' ? json.score : (json.correct ? 1 : 0),
            reason: String(json.reason || '').trim()
        };
    }

    async function batchGenerateExplanations(questions, onProgress) {
        const results = [];
        for (let i = 0; i < questions.length; i++) {
            const q = normalizeQuestion(questions[i]);
            if (typeof onProgress === 'function') {
                onProgress(i, questions.length, q);
            }
            const explanation = await generateExplanation(q);
            results.push({
                index: i,
                explanation
            });
        }
        return results;
    }

    async function ocrQuestionsFromImage(file, mimeType) {
        if (!file) {
            throw new Error('未选择图片');
        }
        const imageDataUrl = await fileToDataUrl(file);
        const prompt = [
            '请识别图片中的题目内容，并整理成标准 JSON。',
            '只返回 JSON，不要解释。',
            '格式：{"questions":[{"type":"single|multiple|truefalse|fillblank|shortanswer","content":"题目","options":["选项A"],"answer":"答案","explanation":"解析"}]}',
            '如果图片中没有明确解析，explanation 设为空字符串。',
            '如果图片中没有明确答案，也尽量根据图片内容提取，不要编造。'
        ].join('\n');

        const settings = getSettings();
        const body = {
            model: settings.aiModel,
            temperature: 0.1,
            messages: [
                { role: 'system', content: '你是 OCR 题库识别助手。' },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        { type: 'image_url', image_url: { url: imageDataUrl } }
                    ]
                }
            ]
        };

        let response;
        try {
            response = await fetch(getEndpoint(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + settings.aiApiKey
                },
                body: JSON.stringify(body)
            });
        } catch (error) {
            const reason = error && error.message ? error.message : 'Failed to fetch';
            throw new Error('OCR 请求失败：' + reason);
        }

        if (!response.ok) {
            const text = await response.text();
            throw new Error('OCR 请求失败：' + response.status + ' ' + text.slice(0, 200));
        }

        const data = await response.json();
        const content = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : '';
        const json = extractJson(content);
        if (!json.questions || !Array.isArray(json.questions)) {
            throw new Error('OCR 未返回 questions 数组');
        }
        return json.questions.map(normalizeQuestion).filter(q => q.content);
    }

    function fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('读取图片失败'));
            reader.readAsDataURL(file);
        });
    }

    return {
        isConfigured,
        parseQuestionsFromText,
        generateExplanation,
        testConnection,
        gradeSubjectiveAnswer,
        batchGenerateExplanations,
        ocrQuestionsFromImage
    };
})();
