/**
 * Storage - 数据存储层
 * 基于 localStorage 的持久化存储
 */

const Storage = (function() {

    const DB_KEY = 'quiz_master_db';

    function getDefaultBankStats() {
        return {
            totalPracticed: 0,
            totalCorrect: 0,
            history: [] // {date: 'YYYY-MM-DD', practiced: 0, correct: 0, rate: 0}
        };
    }

    function getDefaultStats() {
        return {
            totalPracticed: 0,
            totalCorrect: 0,
            history: [],
            bankStats: {}
        };
    }

    // 默认数据库结构
    function getDefaultDB() {
        return {
            banks: [],
            errorBook: [],
            practiceSessions: {},
            stats: getDefaultStats(),
            settings: {
                studyShuffle: true,
                practiceShuffle: true,
                optionShuffle: false,
                autoError: true,
                showExplanation: true,
                aiEnabled: false,
                aiBaseUrl: 'https://api.openai.com/v1',
                aiApiKey: '',
                aiModel: 'gpt-4o-mini',
                aiUseForImport: true,
                aiUseForExplanation: true,
                aiAutoExplainAfterImport: false,
                aiUseForSubjectiveGrading: true,
                aiAutoFallback: true
            },
            version: 2
        };
    }

    // 生成 UUID
    function uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function limitRecentHistory(history) {
        return history.sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
    }

    function normalizeHistory(history) {
        if (!Array.isArray(history)) return [];
        const normalized = history.map(item => ({
            date: item && item.date ? item.date : '',
            practiced: Math.max(0, Number(item && item.practiced) || 0),
            correct: Math.max(0, Number(item && item.correct) || 0)
        })).filter(item => item.date);

        normalized.forEach(item => {
            item.rate = item.practiced > 0 ? Math.round(item.correct / item.practiced * 100) : 0;
        });

        return limitRecentHistory(normalized);
    }

    function normalizeBankStats(stats) {
        const normalized = Object.assign({}, getDefaultBankStats(), stats || {});
        normalized.totalPracticed = Math.max(0, Number(normalized.totalPracticed) || 0);
        normalized.totalCorrect = Math.max(0, Number(normalized.totalCorrect) || 0);
        normalized.history = normalizeHistory(normalized.history);
        return normalized;
    }

    function normalizeBankStatsMap(map) {
        const result = {};
        if (!map || typeof map !== 'object') return result;
        Object.keys(map).forEach(bankId => {
            result[bankId] = normalizeBankStats(map[bankId]);
        });
        return result;
    }

    function normalizeQuestion(question) {
        return {
            id: question && question.id ? question.id : uuid(),
            type: question && question.type ? question.type : 'single',
            content: question && question.content ? question.content : '',
            options: Array.isArray(question && question.options) ? question.options : [],
            answer: question && question.answer ? question.answer : '',
            explanation: question && question.explanation ? question.explanation : '',
            studied: !!(question && question.studied),
            mastered: !!(question && question.mastered),
            favorite: !!(question && question.favorite),
            wrongCount: Math.max(0, Number(question && question.wrongCount) || 0),
            createdAt: question && question.createdAt ? question.createdAt : Date.now()
        };
    }

    function normalizeBank(bank) {
        return {
            id: bank && bank.id ? bank.id : uuid(),
            name: bank && bank.name ? bank.name : '未命名题库',
            description: bank && bank.description ? bank.description : '',
            questions: Array.isArray(bank && bank.questions) ? bank.questions.map(normalizeQuestion) : [],
            createdAt: bank && bank.createdAt ? bank.createdAt : Date.now(),
            updatedAt: bank && bank.updatedAt ? bank.updatedAt : Date.now()
        };
    }

    function normalizeErrorBook(errorBook) {
        if (!Array.isArray(errorBook)) return [];
        return errorBook.map(item => ({
            id: item && item.id ? item.id : uuid(),
            bankId: item && item.bankId ? item.bankId : '',
            questionId: item && item.questionId ? item.questionId : '',
            wrongAnswer: item && item.wrongAnswer ? item.wrongAnswer : '',
            addedAt: item && item.addedAt ? item.addedAt : Date.now(),
            practicedCount: Math.max(0, Number(item && item.practicedCount) || 0)
        })).filter(item => item.bankId && item.questionId);
    }

    function normalizePracticeSessions(practiceSessions) {
        if (!practiceSessions || typeof practiceSessions !== 'object') return {};
        return Object.assign({}, practiceSessions);
    }

    function normalizeStats(stats) {
        const normalized = Object.assign({}, getDefaultStats(), stats || {});
        normalized.totalPracticed = Math.max(0, Number(normalized.totalPracticed) || 0);
        normalized.totalCorrect = Math.max(0, Number(normalized.totalCorrect) || 0);
        normalized.history = normalizeHistory(normalized.history);
        normalized.bankStats = normalizeBankStatsMap(normalized.bankStats);
        return normalized;
    }

    function normalizeDB(raw) {
        const defaults = getDefaultDB();
        return {
            banks: Array.isArray(raw && raw.banks) ? raw.banks.map(normalizeBank) : [],
            errorBook: normalizeErrorBook(raw && raw.errorBook),
            practiceSessions: normalizePracticeSessions(raw && raw.practiceSessions),
            stats: normalizeStats(raw && raw.stats),
            settings: Object.assign({}, defaults.settings, (raw && raw.settings) || {}),
            version: raw && raw.version ? raw.version : defaults.version
        };
    }

    function upsertHistory(history, date, practiced, correct) {
        if (!date) return;
        const practicedNum = Math.max(0, Number(practiced) || 0);
        const correctNum = Math.max(0, Number(correct) || 0);
        if (practicedNum === 0 && correctNum === 0) return;

        const existing = history.find(item => item.date === date);
        if (existing) {
            existing.practiced += practicedNum;
            existing.correct += correctNum;
            existing.rate = existing.practiced > 0
                ? Math.round(existing.correct / existing.practiced * 100)
                : 0;
        } else {
            history.push({
                date,
                practiced: practicedNum,
                correct: correctNum,
                rate: practicedNum > 0 ? Math.round(correctNum / practicedNum * 100) : 0
            });
        }

        const limited = limitRecentHistory(history);
        history.length = 0;
        limited.forEach(item => history.push(item));
    }

    function ensureBankStats(bankId) {
        if (!bankId) return getDefaultBankStats();
        if (!db.stats.bankStats[bankId]) {
            db.stats.bankStats[bankId] = getDefaultBankStats();
        }
        return db.stats.bankStats[bankId];
    }

    function dedupeBankName(name) {
        const baseName = (name || '导入题库').trim() || '导入题库';
        const existingNames = new Set(db.banks.map(bank => bank.name));
        if (!existingNames.has(baseName)) return baseName;
        let index = 2;
        let nextName = `${baseName}（${index}）`;
        while (existingNames.has(nextName)) {
            index++;
            nextName = `${baseName}（${index}）`;
        }
        return nextName;
    }

    function isBankPackageObject(payload) {
        return !!payload
            && payload.packageType === 'quiz-master-bank-package'
            && payload.bank
            && Array.isArray(payload.bank.questions);
    }

    function parseBankPackage(input) {
        try {
            const payload = typeof input === 'string' ? JSON.parse(input) : input;
            if (!isBankPackageObject(payload)) return null;
            return {
                packageType: payload.packageType,
                version: payload.version || 1,
                exportedAt: payload.exportedAt || Date.now(),
                sourceApp: payload.sourceApp || '题库大师',
                bank: normalizeBank(payload.bank),
                bankStats: normalizeBankStats(payload.bankStats),
                relatedErrorBook: normalizeErrorBook(payload.relatedErrorBook),
                practiceSession: payload.practiceSession || null
            };
        } catch (e) {
            return null;
        }
    }

    // 读取数据库
    function loadDB() {
        try {
            const raw = localStorage.getItem(DB_KEY);
            if (!raw) return getDefaultDB();
            return normalizeDB(JSON.parse(raw));
        } catch (e) {
            console.error('Failed to load DB:', e);
            return getDefaultDB();
        }
    }

    // 保存数据库
    function saveDB(db) {
        try {
            localStorage.setItem(DB_KEY, JSON.stringify(db));
            return true;
        } catch (e) {
            console.error('Failed to save DB:', e);
            return false;
        }
    }

    let db = loadDB();

    // ==================== 题库管理 ====================

    function getAllBanks() {
        return db.banks.map(b => ({
            id: b.id,
            name: b.name,
            description: b.description,
            questionCount: b.questions.length,
            studiedCount: b.questions.filter(q => q.studied).length,
            masteredCount: b.questions.filter(q => q.mastered).length,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt
        }));
    }

    function getBank(bankId) {
        return db.banks.find(b => b.id === bankId);
    }

    function createBank(name, description) {
        const bank = {
            id: uuid(),
            name: name,
            description: description || '',
            questions: [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        db.banks.push(bank);
        saveDB(db);
        return bank;
    }

    function renameBank(bankId, newName) {
        const bank = getBank(bankId);
        if (bank) {
            bank.name = newName;
            bank.updatedAt = Date.now();
            saveDB(db);
        }
    }

    function deleteBank(bankId) {
        db.banks = db.banks.filter(b => b.id !== bankId);
        db.errorBook = db.errorBook.filter(e => e.bankId !== bankId);
        delete db.practiceSessions[bankId];
        delete db.stats.bankStats[bankId];
        saveDB(db);
    }

    function updateBankDescription(bankId, desc) {
        const bank = getBank(bankId);
        if (bank) {
            bank.description = desc;
            bank.updatedAt = Date.now();
            saveDB(db);
        }
    }

    // ==================== 题目管理 ====================

    function getQuestions(bankId) {
        const bank = getBank(bankId);
        return bank ? bank.questions : [];
    }

    function getQuestion(bankId, questionId) {
        const bank = getBank(bankId);
        if (!bank) return null;
        return bank.questions.find(q => q.id === questionId);
    }

    function getAllFavorites() {
        const favorites = [];
        db.banks.forEach(bank => {
            bank.questions.forEach(question => {
                if (question.favorite) {
                    favorites.push({
                        bankId: bank.id,
                        bankName: bank.name,
                        question
                    });
                }
            });
        });
        return favorites;
    }

    function addQuestion(bankId, question) {
        const bank = getBank(bankId);
        if (!bank) return null;
        const q = normalizeQuestion(question);
        bank.questions.push(q);
        bank.updatedAt = Date.now();
        saveDB(db);
        return q;
    }

    function addQuestions(bankId, questions) {
        const bank = getBank(bankId);
        if (!bank) return 0;
        let count = 0;
        questions.forEach(question => {
            const q = normalizeQuestion(question);
            bank.questions.push(q);
            count++;
        });
        bank.updatedAt = Date.now();
        saveDB(db);
        return count;
    }

    function updateQuestion(bankId, questionId, updates) {
        const bank = getBank(bankId);
        if (!bank) return;
        const q = bank.questions.find(item => item.id === questionId);
        if (q) {
            Object.assign(q, updates);
            bank.updatedAt = Date.now();
            saveDB(db);
        }
    }

    function deleteQuestion(bankId, questionId) {
        const bank = getBank(bankId);
        if (!bank) return;
        bank.questions = bank.questions.filter(q => q.id !== questionId);
        bank.updatedAt = Date.now();
        db.errorBook = db.errorBook.filter(e => !(e.bankId === bankId && e.questionId === questionId));
        saveDB(db);
    }

    function markStudied(bankId, questionId, studied) {
        const bank = getBank(bankId);
        if (!bank) return;
        const q = bank.questions.find(item => item.id === questionId);
        if (q) {
            q.studied = studied;
            saveDB(db);
        }
    }

    function markMastered(bankId, questionId, mastered) {
        const bank = getBank(bankId);
        if (!bank) return;
        const q = bank.questions.find(item => item.id === questionId);
        if (q) {
            q.mastered = mastered;
            saveDB(db);
        }
    }

    function incrementWrongCount(bankId, questionId) {
        const bank = getBank(bankId);
        if (!bank) return;
        const q = bank.questions.find(item => item.id === questionId);
        if (q) {
            q.wrongCount = (q.wrongCount || 0) + 1;
            saveDB(db);
        }
    }

    function toggleFavorite(bankId, questionId) {
        const bank = getBank(bankId);
        if (!bank) return false;
        const q = bank.questions.find(item => item.id === questionId);
        if (!q) return false;
        q.favorite = !q.favorite;
        bank.updatedAt = Date.now();
        saveDB(db);
        return q.favorite;
    }

    function setFavorite(bankId, questionId, favorite) {
        const bank = getBank(bankId);
        if (!bank) return false;
        const q = bank.questions.find(item => item.id === questionId);
        if (!q) return false;
        q.favorite = !!favorite;
        bank.updatedAt = Date.now();
        saveDB(db);
        return q.favorite;
    }

    // ==================== 刷题进度 ====================

    function getPracticeSession(bankId) {
        return db.practiceSessions[bankId] || null;
    }

    function savePracticeSession(bankId, session) {
        if (!bankId || !session) return false;
        db.practiceSessions[bankId] = Object.assign({ savedAt: Date.now() }, session, { savedAt: Date.now() });
        saveDB(db);
        return true;
    }

    function clearPracticeSession(bankId) {
        if (!bankId) return;
        delete db.practiceSessions[bankId];
        saveDB(db);
    }

    function getGenericPracticeSession(sessionKey) {
        return db.practiceSessions[sessionKey] || null;
    }

    function saveGenericPracticeSession(sessionKey, session) {
        if (!sessionKey || !session) return false;
        db.practiceSessions[sessionKey] = Object.assign({ savedAt: Date.now() }, session, { savedAt: Date.now() });
        saveDB(db);
        return true;
    }

    function clearGenericPracticeSession(sessionKey) {
        if (!sessionKey) return;
        delete db.practiceSessions[sessionKey];
        saveDB(db);
    }

    // ==================== 错题本 ====================

    function getErrorBook() {
        return db.errorBook.map(e => {
            const bank = getBank(e.bankId);
            const question = bank ? bank.questions.find(q => q.id === e.questionId) : null;
            return {
                ...e,
                bankName: bank ? bank.name : '已删除题库',
                question: question
            };
        }).filter(e => e.question);
    }

    function getErrorsByBank(bankId) {
        return getErrorBook().filter(e => e.bankId === bankId);
    }

    function addError(bankId, questionId, wrongAnswer) {
        const existing = db.errorBook.find(e => e.bankId === bankId && e.questionId === questionId);
        if (existing) {
            existing.wrongAnswer = wrongAnswer;
            existing.addedAt = Date.now();
            existing.practicedCount = (existing.practicedCount || 0);
        } else {
            db.errorBook.push({
                id: uuid(),
                bankId: bankId,
                questionId: questionId,
                wrongAnswer: wrongAnswer,
                addedAt: Date.now(),
                practicedCount: 0
            });
        }
        incrementWrongCount(bankId, questionId);
        saveDB(db);
    }

    function removeError(errorId) {
        db.errorBook = db.errorBook.filter(e => e.id !== errorId);
        saveDB(db);
    }

    function removeErrorByQuestion(bankId, questionId) {
        db.errorBook = db.errorBook.filter(e => !(e.bankId === bankId && e.questionId === questionId));
        saveDB(db);
    }

    function clearAllErrors() {
        db.errorBook = [];
        saveDB(db);
    }

    function clearErrorsByBank(bankId) {
        db.errorBook = db.errorBook.filter(e => e.bankId !== bankId);
        saveDB(db);
    }

    // ==================== 统计 ====================

    function getStats() {
        const banks = db.banks;
        const totalQuestions = banks.reduce((sum, b) => sum + b.questions.length, 0);
        const totalMastered = banks.reduce((sum, b) => sum + b.questions.filter(q => q.mastered).length, 0);
        const totalStudied = banks.reduce((sum, b) => sum + b.questions.filter(q => q.studied).length, 0);

        return {
            totalBanks: banks.length,
            totalQuestions,
            totalMastered,
            totalStudied,
            totalPracticed: db.stats.totalPracticed,
            totalCorrect: db.stats.totalCorrect,
            overallRate: db.stats.totalPracticed > 0 ? Math.round(db.stats.totalCorrect / db.stats.totalPracticed * 100) : 0,
            errorCount: db.errorBook.length,
            history: db.stats.history,
            bankStats: db.stats.bankStats
        };
    }

    function getBankStudyStats(bankId) {
        const bank = getBank(bankId);
        if (!bank) return null;
        const bankStats = normalizeBankStats(db.stats.bankStats[bankId]);
        const totalQuestions = bank.questions.length;
        const studiedCount = bank.questions.filter(q => q.studied).length;
        const masteredCount = bank.questions.filter(q => q.mastered).length;
        const favoriteCount = bank.questions.filter(q => q.favorite).length;
        const errorCount = db.errorBook.filter(e => e.bankId === bankId).length;

        return {
            bankId,
            totalQuestions,
            studiedCount,
            masteredCount,
            favoriteCount,
            errorCount,
            totalPracticed: bankStats.totalPracticed,
            totalCorrect: bankStats.totalCorrect,
            accuracy: bankStats.totalPracticed > 0 ? Math.round(bankStats.totalCorrect / bankStats.totalPracticed * 100) : 0,
            history: bankStats.history,
            hasSavedSession: !!db.practiceSessions[bankId]
        };
    }

    function recordPractice(total, correct, options) {
        const practicedTotal = Math.max(0, Number(total) || 0);
        const correctTotal = Math.max(0, Number(correct) || 0);
        const today = options && options.date ? options.date : new Date().toISOString().split('T')[0];

        db.stats.totalPracticed += practicedTotal;
        db.stats.totalCorrect += correctTotal;
        upsertHistory(db.stats.history, today, practicedTotal, correctTotal);

        let bankBreakdown = options && options.bankBreakdown;
        if ((!bankBreakdown || typeof bankBreakdown !== 'object') && options && options.bankId) {
            bankBreakdown = {
                [options.bankId]: {
                    practiced: practicedTotal,
                    correct: correctTotal
                }
            };
        }

        if (bankBreakdown && typeof bankBreakdown === 'object') {
            Object.keys(bankBreakdown).forEach(bankId => {
                const item = bankBreakdown[bankId] || {};
                const practiced = Math.max(0, Number(item.practiced != null ? item.practiced : item.total) || 0);
                const itemCorrect = Math.max(0, Number(item.correct) || 0);
                if (practiced === 0 && itemCorrect === 0) return;
                const bankStats = ensureBankStats(bankId);
                bankStats.totalPracticed += practiced;
                bankStats.totalCorrect += itemCorrect;
                upsertHistory(bankStats.history, today, practiced, itemCorrect);
            });
        }

        saveDB(db);
    }

    function getRecentHistory(days) {
        days = days || 7;
        const history = db.stats.history.slice(-days);
        const result = [];
        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const record = history.find(h => h.date === dateStr);
            result.push(record || { date: dateStr, practiced: 0, correct: 0, rate: 0 });
        }
        return result;
    }

    // ==================== 设置 ====================

    function getSettings() {
        return { ...db.settings };
    }

    function updateSettings(updates) {
        Object.assign(db.settings, updates);
        saveDB(db);
    }

    // ==================== 数据导入导出 ====================

    function exportData() {
        return JSON.stringify(db, null, 2);
    }

    function exportBankPackage(bankId) {
        const bank = getBank(bankId);
        if (!bank) return '';
        const payload = {
            packageType: 'quiz-master-bank-package',
            version: 1,
            exportedAt: Date.now(),
            sourceApp: '题库大师',
            bank: JSON.parse(JSON.stringify(bank)),
            bankStats: JSON.parse(JSON.stringify(normalizeBankStats(db.stats.bankStats[bankId]))),
            relatedErrorBook: JSON.parse(JSON.stringify(db.errorBook.filter(item => item.bankId === bankId))),
            practiceSession: db.practiceSessions[bankId]
                ? JSON.parse(JSON.stringify(db.practiceSessions[bankId]))
                : null
        };
        return JSON.stringify(payload, null, 2);
    }

    function importBankPackage(input) {
        try {
            const payload = parseBankPackage(input);
            if (!payload) {
                return { success: false, message: '不是可识别的题库互通包' };
            }

            const importedBankId = uuid();
            const importedBank = {
                id: importedBankId,
                name: dedupeBankName(payload.bank.name),
                description: payload.bank.description || '',
                questions: payload.bank.questions.map(question => normalizeQuestion({ ...question })),
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            db.banks.push(importedBank);

            payload.relatedErrorBook.forEach(item => {
                db.errorBook.push({
                    id: uuid(),
                    bankId: importedBankId,
                    questionId: item.questionId,
                    wrongAnswer: item.wrongAnswer || '',
                    addedAt: item.addedAt || Date.now(),
                    practicedCount: Math.max(0, Number(item.practicedCount) || 0)
                });
            });

            if (payload.practiceSession) {
                db.practiceSessions[importedBankId] = Object.assign({}, payload.practiceSession, {
                    savedAt: payload.practiceSession.savedAt || Date.now()
                });
            }

            const importedBankStats = normalizeBankStats(payload.bankStats);
            db.stats.bankStats[importedBankId] = importedBankStats;
            db.stats.totalPracticed += importedBankStats.totalPracticed;
            db.stats.totalCorrect += importedBankStats.totalCorrect;
            importedBankStats.history.forEach(item => {
                upsertHistory(db.stats.history, item.date, item.practiced, item.correct);
            });

            saveDB(db);
            return {
                success: true,
                message: `题库互通包已导入：${importedBank.name}`,
                bankId: importedBankId
            };
        } catch (e) {
            return { success: false, message: '导入题库互通包失败：' + e.message };
        }
    }

    function importData(jsonStr) {
        try {
            const imported = JSON.parse(jsonStr);
            if (!imported.banks) {
                return { success: false, message: '文件格式不正确' };
            }
            db = normalizeDB(imported);
            saveDB(db);
            return { success: true, message: '导入成功' };
        } catch (e) {
            return { success: false, message: '导入失败：' + e.message };
        }
    }

    function clearAllData() {
        db = getDefaultDB();
        saveDB(db);
    }

    // ==================== 工具方法 ====================

    function getQuestionTypeName(type) {
        const names = {
            single: '单选题',
            multiple: '多选题',
            truefalse: '判断题',
            fillblank: '填空题',
            shortanswer: '简答题'
        };
        return names[type] || type;
    }

    // 公开API
    return {
        // 题库
        getAllBanks,
        getBank,
        createBank,
        renameBank,
        deleteBank,
        updateBankDescription,
        getBankStudyStats,
        // 题目
        getQuestions,
        getQuestion,
        getAllFavorites,
        addQuestion,
        addQuestions,
        updateQuestion,
        deleteQuestion,
        markStudied,
        markMastered,
        incrementWrongCount,
        toggleFavorite,
        setFavorite,
        // 错题本
        getErrorBook,
        getErrorsByBank,
        addError,
        removeError,
        removeErrorByQuestion,
        clearAllErrors,
        clearErrorsByBank,
        getPracticeSession,
        savePracticeSession,
        clearPracticeSession,
        getGenericPracticeSession,
        saveGenericPracticeSession,
        clearGenericPracticeSession,
        // 统计
        getStats,
        recordPractice,
        getRecentHistory,
        // 设置
        getSettings,
        updateSettings,
        // 数据
        exportData,
        exportBankPackage,
        parseBankPackage,
        importBankPackage,
        importData,
        clearAllData,
        // 工具
        getQuestionTypeName,
        uuid
    };
})();
