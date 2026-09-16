/**
 * Parser - 题目文本解析器
 * 自动识别题型并提取题目、选项、答案、解析
 *
 * 支持的题型：
 *   - 单选题 (single)
 *   - 多选题 (multiple)
 *   - 判断题 (truefalse)
 *   - 填空题 (fillblank)
 *   - 简答题 (shortanswer)
 */

const Parser = (function() {

    // 正则表达式定义
    const REG = {
        // 题号：1. 1、 1) (1) 【1】 等
        questionNum: /^(?:\d+)[.、)）\]】]\s*/,
        questionNumAny: /(?:^|\n)\s*(\d+)[.、)）\]】]\s*/,
        // 选项：A. A、 A) (A) 等
        option: /^([A-Z])[.、)）\]】]\s*(.*)/,
        optionLine: /^\s*([A-Z])[.、)）\]】]\s*(.*)/,
        // 答案标记
        answer: /^[\s]*[(（]?\s*答案\s*[)）]?\s*[:：]\s*/,
        correctAnswer: /^[\s]*[(（]?\s*正确答案\s*[)）]?\s*[:：]\s*/,
        // 解析标记
        explanation: /^[\s]*[(（]?\s*解析\s*[)）]?\s*[:：]\s*/,
        answerAnalysis: /^[\s]*[(（]?\s*答案解析\s*[)）]?\s*[:：]\s*/,
        // 判断题答案
        truePattern: /^(正确|对|是|√|T|True|TRUE|right|Y|✓)/i,
        falsePattern: /^(错误|错|否|×|F|False|FALSE|wrong|N|✗)/i,
        // 填空标记
        blankPattern: /[_]{2,}|[＿]{2,}/,
        // 多选答案
        multiAnswerPattern: /^[A-Z]{2,}$/i,
    };

    /**
     * 主解析函数
     * @param {string} text - 原始文本
     * @returns {Array} 解析出的题目数组
     */
    function parse(text) {
        if (!text || !text.trim()) return [];

        // 统一换行符
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // 分割成题目块
        const blocks = splitIntoBlocks(text);
        const questions = [];

        for (const block of blocks) {
            const q = parseBlock(block);
            if (q) questions.push(q);
        }

        return questions;
    }

    /**
     * 将文本分割成题目块
     * 以题号开头的行作为分隔标志
     */
    function splitIntoBlocks(text) {
        const lines = text.split('\n');
        const blocks = [];
        let currentBlock = [];
        let inQuestion = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // 跳过空行（但保留在块内用于结构解析）
            if (trimmed === '') {
                if (inQuestion) currentBlock.push(line);
                continue;
            }

            // 检测题号开头
            if (REG.questionNum.test(trimmed)) {
                // 保存上一个块
                if (currentBlock.length > 0 && inQuestion) {
                    blocks.push(currentBlock.join('\n'));
                }
                currentBlock = [line];
                inQuestion = true;
            } else if (inQuestion) {
                currentBlock.push(line);
            } else {
                // 没有题号的文本，作为单独块
                currentBlock.push(line);
                inQuestion = true;
            }
        }

        // 保存最后一个块
        if (currentBlock.length > 0) {
            blocks.push(currentBlock.join('\n'));
        }

        return blocks.filter(b => b.trim());
    }

    /**
     * 解析单个题目块
     */
    function parseBlock(block) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l);

        if (lines.length === 0) return null;

        let questionText = '';
        let options = [];
        let answer = '';
        let explanation = '';
        let currentSection = 'question'; // question | options | answer | explanation

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // 检测答案标记
            if (REG.answerAnalysis.test(line) || REG.correctAnswer.test(line) || REG.answer.test(line)) {
                answer = line.replace(REG.answerAnalysis, '').replace(REG.correctAnswer, '').replace(REG.answer, '').trim();
                currentSection = 'answer';
                continue;
            }

            // 检测解析标记
            if (REG.explanation.test(line)) {
                explanation = line.replace(REG.explanation, '').trim();
                currentSection = 'explanation';
                continue;
            }

            // 检测选项
            if (REG.optionLine.test(line)) {
                const match = line.match(REG.optionLine);
                if (match) {
                    options.push(match[2].trim());
                    currentSection = 'options';
                    continue;
                }
            }

            // 根据当前区域追加内容
            if (currentSection === 'question') {
                questionText = questionText ? questionText + ' ' + line : line;
            } else if (currentSection === 'options') {
                // 选项的多行内容（如果有）
                const lastOption = options.length - 1;
                if (lastOption >= 0) {
                    options[lastOption] += ' ' + line;
                }
            } else if (currentSection === 'answer') {
                answer = answer ? answer + ' ' + line : line;
            } else if (currentSection === 'explanation') {
                explanation = explanation ? explanation + ' ' + line : line;
            }
        }

        // 清理题号前缀
        questionText = questionText.replace(REG.questionNum, '').trim();

        if (!questionText) return null;

        // 识别题型
        const type = detectType(questionText, options, answer);

        // 清理答案格式
        answer = cleanAnswer(answer, type);

        return {
            type: type,
            content: questionText,
            options: options,
            answer: answer,
            explanation: explanation
        };
    }

    /**
     * 自动识别题型
     */
    function detectType(question, options, answer) {
        // 有选项的情况
        if (options.length > 0) {
            // 答案是多个字母 -> 多选题
            if (answer && REG.multiAnswerPattern.test(answer.trim())) {
                return 'multiple';
            }
            // 默认单选
            return 'single';
        }

        // 没有选项
        // 判断题：答案是对/错/正确/错误/√/×/T/F 等
        if (answer) {
            const ans = answer.trim();
            if (REG.truePattern.test(ans) || REG.falsePattern.test(ans)) {
                return 'truefalse';
            }
        }

        // 填空题：题目中有连续下划线
        if (REG.blankPattern.test(question)) {
            return 'fillblank';
        }

        // 默认简答题
        return 'shortanswer';
    }

    /**
     * 清理答案格式
     */
    function cleanAnswer(answer, type) {
        if (!answer) return '';
        answer = answer.trim();

        if (type === 'truefalse') {
            // 统一判断题答案为"正确"或"错误"
            if (REG.truePattern.test(answer)) return '正确';
            if (REG.falsePattern.test(answer)) return '错误';
        }

        if (type === 'single' || type === 'multiple') {
            // 清理选项答案：只保留字母
            answer = answer.toUpperCase().replace(/[^A-Z]/g, '');
        }

        return answer;
    }

    /**
     * 格式化题目为可读文本（用于编辑器显示）
     */
    function formatQuestion(q) {
        let text = q.content + '\n';
        if (q.options && q.options.length > 0) {
            const labels = 'ABCDEFGHIJ';
            q.options.forEach((opt, i) => {
                text += `${labels[i]}. ${opt}\n`;
            });
        }
        text += `答案：${q.answer}\n`;
        if (q.explanation) {
            text += `解析：${q.explanation}\n`;
        }
        return text;
    }

    /**
     * 生成示例文本
     */
    function getExampleText() {
        return `1. 以下哪个不是面向对象编程的基本特征？
A. 封装
B. 继承
C. 编译
D. 多态
答案：C
解析：面向对象编程的基本特征是封装、继承和多态，编译是程序的构建过程。

2. Java中以下哪些是基本数据类型？
A. int
B. String
C. boolean
D. double
答案：ACD
解析：String是引用类型，不是基本数据类型。Java的基本数据类型有8种：byte, short, int, long, float, double, char, boolean。

3. Python是一种解释型语言。
答案：正确
解析：Python是解释型语言，代码在运行时由解释器逐行执行。

4. HTML的中文全称是____。
答案：超文本标记语言
解析：HTML是HyperText Markup Language的缩写。

5. 简述什么是递归。
答案：递归是指函数直接或间接调用自身的一种编程技巧，通常包含基线条件和递归条件两个部分。
解析：递归需要有终止条件（基线条件）防止无限循环，以及递归条件使问题规模逐步缩小。`;
    }

    return {
        parse: parse,
        formatQuestion: formatQuestion,
        getExampleText: getExampleText
    };
})();
