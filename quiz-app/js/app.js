/**
 * App - 主应用逻辑
 */

const App = (function() {

    // ==================== 应用状态 ====================
    const state = {
        currentView: 'home',
        currentBankId: null,
        currentPracticeType: '',
        currentStudyType: '',
        // 背题
        studyQuestions: [],
        studyIndex: 0,
        studyFlipped: false,
        // 刷题
        practiceQuestions: [],
        practiceIndex: 0,
        practiceAnswers: {}, // questionId -> user answer
        practiceResults: [], // {questionId, correct, userAnswer, skipped, aiReason, aiScore}
        practiceScore: 0,
        practiceWrongOnly: false,
        practiceBankMap: {}, // questionId -> bankId (for cross-bank error practice)
        practiceSessionMode: 'new',
        practiceFinishedQuestions: {},
        favoritePracticeMode: false,
        practiceSessionKey: '',
        // 编辑题目
        editingQuestionId: null,
        editOptions: [],
        // 导入预览
        previewQuestions: [],
        // 错题练习
        errorPracticeMode: false,
        // 导入文件/图片上下文
        lastImportedFileType: '',
        lastImportedImageName: '',
        practiceSubmitting: false,
    };

    // ==================== 视图导航 ====================

    function navigate(viewName) {
        // 隐藏所有视图
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        // 显示目标视图
        const target = document.getElementById('view-' + viewName);
        if (target) {
            target.classList.add('active');
            state.currentView = viewName;
        }

        // 更新底部导航
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === viewName);
        });

        // 加载对应视图数据
        switch (viewName) {
            case 'home': renderBankList(); break;
            case 'favorites': renderFavorites(); break;
            case 'error-book': renderErrorBook(); break;
            case 'stats': renderStats(); break;
            case 'settings': renderSettings(); break;
        }

        // 显示/隐藏底部导航
        const showNav = ['home', 'favorites', 'error-book', 'stats', 'settings'].includes(viewName);
        document.querySelector('.bottom-nav').style.display = showNav ? 'flex' : 'none';
        // FAB只在首页显示
        document.querySelector('.fab').style.display = viewName === 'home' ? 'flex' : 'none';
    }

    function backToHome() {
        navigate('home');
    }

    // ==================== 首页 - 题库列表 ====================

    function renderBankList() {
        const banks = Storage.getAllBanks();
        const listEl = document.getElementById('bank-list');
        const emptyEl = document.getElementById('bank-empty');

        if (banks.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'flex';
            return;
        }

        emptyEl.style.display = 'none';
        listEl.innerHTML = banks.map(bank => `
            <div class="bank-card" onclick="App.openBank('${bank.id}')">
                <div class="bank-card-header">
                    <div class="bank-card-name">${escapeHtml(bank.name)}</div>
                    <button class="bank-card-menu" onclick="event.stopPropagation(); App.showBankMenu('${bank.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                    </button>
                </div>
                ${bank.description ? `<div class="bank-card-desc">${escapeHtml(bank.description)}</div>` : ''}
                <div class="bank-card-stats">
                    <div class="bank-card-stat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span>${bank.questionCount}题</span>
                    </div>
                    <div class="bank-card-stat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>掌握${bank.masteredCount}</span>
                    </div>
                    <div class="bank-card-stat">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        <span>${formatTime(bank.updatedAt)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function filterBanks(keyword) {
        const banks = Storage.getAllBanks();
        const filtered = keyword
            ? banks.filter(b => b.name.toLowerCase().includes(keyword.toLowerCase()) ||
                               (b.description && b.description.toLowerCase().includes(keyword.toLowerCase())))
            : banks;
        const listEl = document.getElementById('bank-list');
        const emptyEl = document.getElementById('bank-empty');

        if (filtered.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'flex';
            emptyEl.querySelector('p').textContent = keyword ? '未找到匹配的题库' : '还没有题库';
            return;
        }

        emptyEl.style.display = 'none';
        listEl.innerHTML = filtered.map(bank => `
            <div class="bank-card" onclick="App.openBank('${bank.id}')">
                <div class="bank-card-header">
                    <div class="bank-card-name">${escapeHtml(bank.name)}</div>
                    <button class="bank-card-menu" onclick="event.stopPropagation(); App.showBankMenu('${bank.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                    </button>
                </div>
                ${bank.description ? `<div class="bank-card-desc">${escapeHtml(bank.description)}</div>` : ''}
                <div class="bank-card-stats">
                    <div class="bank-card-stat"><span>${bank.questionCount}题</span></div>
                    <div class="bank-card-stat"><span>掌握${bank.masteredCount}</span></div>
                </div>
            </div>
        `).join('');
    }

    // ==================== 题库详情 ====================

    function openBank(bankId) {
        state.currentBankId = bankId;
        const bank = Storage.getBank(bankId);
        if (!bank) {
            showToast('题库不存在');
            return;
        }

        document.getElementById('bank-detail-title').textContent = bank.name;
        document.getElementById('bank-q-count').textContent = bank.questions.length;
        document.getElementById('bank-studied').textContent = bank.questions.filter(q => q.studied).length;
        document.getElementById('bank-mastered').textContent = bank.questions.filter(q => q.mastered).length;

        renderTypeActionSection(bank);
        renderQuestionList(bankId);
        navigateTo('bank-detail');
    }

    function renderTypeActionSection(bank) {
        const sectionEl = document.getElementById('type-action-section');
        if (!sectionEl) return;

        const questionTypes = ['single', 'multiple', 'truefalse', 'fillblank', 'shortanswer'];
        const items = questionTypes.map(type => {
            const count = bank.questions.filter(q => q.type === type).length;
            return { type, count };
        }).filter(item => item.count > 0);

        if (items.length === 0) {
            sectionEl.innerHTML = '<div style="font-size:13px;color:var(--text-secondary);">当前题库暂无可分类的题目</div>';
            return;
        }

        sectionEl.innerHTML = items.map(item => `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-top:1px solid var(--border-light);">
                <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                    <span class="question-item-type ${item.type}">${Storage.getQuestionTypeName(item.type)}</span>
                    <span style="font-size:13px;color:var(--text-secondary);">${item.count} 题</span>
                </div>
                <div style="display:flex;gap:8px;flex-shrink:0;">
                    <button class="text-btn" onclick="App.startStudyByType('${item.type}')">背题</button>
                    <button class="text-btn" onclick="App.startPracticeByType('${item.type}')">刷题</button>
                </div>
            </div>
        `).join('');
    }

    function renderQuestionList(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        const listEl = document.getElementById('question-list');

        if (bank.questions.length === 0) {
            listEl.innerHTML = `<div class="empty-state">
                <p>暂无题目</p>
                <p class="empty-sub">点击"添加题目"或返回导入</p>
            </div>`;
            return;
        }

        listEl.innerHTML = bank.questions.map((q, idx) => `
            <div class="question-item">
                <div class="question-item-content" onclick="App.showEditQuestion('${bankId}', '${q.id}')">
                    <span class="question-item-type ${q.type}">${Storage.getQuestionTypeName(q.type)}</span>
                    <div class="question-item-text">${idx + 1}. ${escapeHtml(q.content)}</div>
                    <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">
                        ${q.explanation ? '已含解析' : '暂无解析'}
                    </div>
                </div>
                <div class="question-item-actions">
                    <button onclick="event.stopPropagation(); App.aiGenerateQuestionExplanation('${bankId}', '${q.id}')" aria-label="AI补解析" title="AI补解析">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v6"/><path d="M12 16v6"/><path d="M4.93 4.93l4.24 4.24"/><path d="M14.83 14.83l4.24 4.24"/><path d="M2 12h6"/><path d="M16 12h6"/><path d="M4.93 19.07l4.24-4.24"/><path d="M14.83 9.17l4.24-4.24"/></svg>
                    </button>
                    <button onclick="event.stopPropagation(); App.deleteQuestion('${bankId}', '${q.id}')" aria-label="删除">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    function showBankMenu(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        state.currentBankId = bankId;

        showModal(`
            <div class="modal-header">题库操作</div>
            <div class="modal-item" onclick="App.closeModal(); App.renameBank('${bankId}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                <span>重命名</span>
            </div>
            <div class="modal-item" onclick="App.closeModal(); App.editBankDesc('${bankId}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>编辑描述</span>
            </div>
            <div class="modal-item" onclick="App.closeModal(); App.addQuestionsToBank('${bankId}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>追加题目</span>
            </div>
            <div class="modal-item" onclick="App.closeModal(); App.exportBank('${bankId}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>导出互通包</span>
            </div>
            <div class="modal-item danger" onclick="App.closeModal(); App.confirmDeleteBank('${bankId}')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                <span>删除题库</span>
            </div>
            <div class="modal-cancel" onclick="App.closeModal()">取消</div>
        `);
    }

    function renameBank(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        showPrompt('重命名题库', '输入新的题库名称', bank.name, function(name) {
            if (name && name.trim()) {
                Storage.renameBank(bankId, name.trim());
                showToast('重命名成功');
                renderBankList();
                if (state.currentView === 'bank-detail') {
                    document.getElementById('bank-detail-title').textContent = name.trim();
                }
            }
        });
    }

    function editBankDesc(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        showPrompt('编辑描述', '输入题库描述', bank.description || '', function(desc) {
            Storage.updateBankDescription(bankId, desc.trim());
            showToast('描述已更新');
            renderBankList();
        });
    }

    function confirmDeleteBank(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        showConfirm('删除题库', `确定要删除"${bank.name}"吗？此操作不可撤销，题库中的所有题目和相关错题记录都将被删除。`, function() {
            Storage.deleteBank(bankId);
            showToast('题库已删除');
            renderBankList();
        });
    }

    function exportBank(bankId) {
        const bank = Storage.getBank(bankId);
        if (!bank) return;
        const pkg = Storage.exportBankPackage(bankId);
        if (!pkg) {
            showToast('导出失败，题库不存在');
            return;
        }
        downloadFile(`${bank.name}_题库互通包.qbank.json`, pkg);
        showToast('题库互通包已导出');
    }

    function addQuestionsToBank(bankId) {
        state.currentBankId = bankId;
        state.previewQuestions = [];
        showImport();
        // 设置题库名称为已有名称
        const bank = Storage.getBank(bankId);
        document.getElementById('import-bank-name').value = bank.name;
        document.getElementById('import-bank-name').dataset.existingBankId = bankId;
    }

    // ==================== 导入 ====================

    function showImport() {
        navigateTo('import');
        document.getElementById('import-bank-name').value = '';
        document.getElementById('import-bank-desc').value = '';
        document.getElementById('import-text').value = '';
        document.getElementById('import-bank-name').dataset.existingBankId = '';
        document.getElementById('import-bank-name').dataset.importPackage = '';
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('file-text').value = '';
        document.getElementById('file-content-area').style.display = 'none';
        document.getElementById('file-input').value = '';
        const statusEl = document.getElementById('file-parse-status');
        if (statusEl) {
            statusEl.textContent = '上传后会先自动提取文本，再送入题目解析器';
        }
    }

    function switchImportTab(tab) {
        document.querySelectorAll('.import-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.import-panel').forEach(p => p.classList.remove('active'));
        event.target.classList.add('active');
        document.getElementById('import-' + tab + '-panel').classList.add('active');
    }

    async function previewImport() {
        const text = document.getElementById('import-text').value;
        const bankNameInput = document.getElementById('import-bank-name');
        const bankName = bankNameInput.value.trim();

        if (!text.trim()) {
            showToast('请粘贴题目内容');
            return;
        }

        const pkg = Storage.parseBankPackage(text);
        if (pkg) {
            bankNameInput.dataset.importPackage = 'true';
            bankNameInput.value = pkg.bank.name || bankName;
            document.getElementById('import-bank-desc').value = pkg.bank.description || '';
            state.previewQuestions = pkg.bank.questions || [];
            renderPreview(state.previewQuestions, {
                countText: `互通包：${state.previewQuestions.length} 题`,
                headerText: '题库互通包预览'
            });
            showToast('已识别题库互通包，可直接确认导入');
            return;
        }

        bankNameInput.dataset.importPackage = '';
        if (!bankName) {
            showToast('请输入题库名称');
            return;
        }

        const questions = await resolveQuestionsWithFallback(text, {
            emptyMessage: '未识别到题目，请检查格式',
            failPrefix: 'AI 识别失败，已回退普通解析：'
        });
        if (!questions) return;

        state.previewQuestions = questions;
        renderPreview(questions);
    }

    async function previewFileImport() {
        const text = document.getElementById('file-text').value;
        const bankName = document.getElementById('import-file-bank-name').value.trim();
        const bankNameInput = document.getElementById('import-bank-name');

        if (!text.trim()) {
            showToast('请先选择并解析文件');
            return;
        }

        const pkg = Storage.parseBankPackage(text);
        if (pkg) {
            bankNameInput.dataset.importPackage = 'true';
            bankNameInput.value = pkg.bank.name || bankName;
            document.getElementById('import-bank-desc').value = pkg.bank.description || '';
            state.previewQuestions = pkg.bank.questions || [];
            renderPreview(state.previewQuestions, {
                countText: `互通包：${state.previewQuestions.length} 题`,
                headerText: '题库互通包预览'
            });
            showToast('已识别题库互通包，可直接确认导入');
            return;
        }

        bankNameInput.dataset.importPackage = '';
        if (!bankName) {
            showToast('请输入题库名称');
            return;
        }

        const questions = await resolveQuestionsWithFallback(text, {
            emptyMessage: '已提取文本，但未识别到题目，请检查文档内容格式',
            failPrefix: 'AI 识别失败，已回退普通解析：'
        });
        if (!questions) return;

        state.previewQuestions = questions;
        bankNameInput.value = bankName;
        renderPreview(questions);
    }

    function renderPreview(questions, options) {
        const previewEl = document.getElementById('import-preview');
        const countEl = document.getElementById('preview-count');
        const titleEl = document.getElementById('preview-title');
        const listEl = document.getElementById('preview-list');
        const previewOptions = options || {};

        if (titleEl) {
            titleEl.textContent = previewOptions.headerText || '解析结果';
        }
        countEl.textContent = previewOptions.countText || `共 ${questions.length} 题`;
        listEl.innerHTML = questions.map((q, i) => `
            <div class="preview-item">
                <span class="preview-item-type ${q.type}" style="display:inline-block;font-size:11px;padding:2px 8px;border-radius:4px;font-weight:500;margin-bottom:6px;background:var(--${q.type === 'single' ? 'primary' : q.type === 'multiple' ? 'warning' : q.type === 'truefalse' ? 'success' : 'primary'}-bg);color:var(--${q.type === 'single' ? 'primary' : q.type === 'multiple' ? 'warning' : q.type === 'truefalse' ? 'success' : 'primary'});">
                    ${Storage.getQuestionTypeName(q.type)}
                </span>
                <div class="preview-item-q">${i + 1}. ${escapeHtml(q.content)}</div>
                ${q.options.length > 0 ? `<div style="font-size:13px;color:var(--text-secondary);margin-bottom:4px;">
                    ${q.options.map((o, j) => `${'ABCDEFGH'[j]}. ${escapeHtml(o)}`).join('　')}
                </div>` : ''}
                <div class="preview-item-a">答案：${escapeHtml(q.answer)}</div>
                ${q.explanation ? `<div style="font-size:12px;color:var(--text-tertiary);margin-top:2px;">解析：${escapeHtml(q.explanation)}</div>` : ''}
            </div>
        `).join('');

        previewEl.style.display = 'block';
        previewEl.scrollIntoView({ behavior: 'smooth' });
    }

    async function confirmImport() {
        const bankNameInput = document.getElementById('import-bank-name');
        const bankName = bankNameInput.value.trim();
        const bankDesc = document.getElementById('import-bank-desc').value.trim();
        const existingBankId = bankNameInput.dataset.existingBankId;
        const importPackage = bankNameInput.dataset.importPackage === 'true';
        const packageContent = document.getElementById('import-text').value;
        const questions = state.previewQuestions;
        const settings = Storage.getSettings();

        if (!importPackage && questions.length === 0) {
            showToast('没有可导入的题目');
            return;
        }

        let bankId;
        if (importPackage) {
            const result = Storage.importBankPackage(packageContent);
            showToast(result.message);
            if (!result.success) {
                return;
            }
            bankId = result.bankId;
        } else if (existingBankId) {
            const count = Storage.addQuestions(existingBankId, questions);
            bankId = existingBankId;
            showToast(`成功追加 ${count} 道题目`);
        } else {
            const bank = Storage.createBank(bankName, bankDesc);
            const count = Storage.addQuestions(bank.id, questions);
            bankId = bank.id;
            showToast(`成功导入 ${count} 道题目`);
        }

        state.previewQuestions = [];
        bankNameInput.dataset.importPackage = '';
        openBank(bankId);

        if (settings.aiEnabled && settings.aiUseForExplanation && settings.aiAutoExplainAfterImport) {
            setTimeout(async function() {
                await aiBatchGenerateExplanations(bankId, { onlyMissing: true, silentStart: false });
            }, 50);
        }
    }

    function cancelImport() {
        document.getElementById('import-preview').style.display = 'none';
        document.getElementById('import-bank-name').dataset.importPackage = '';
        state.previewQuestions = [];
    }

    async function handleFileUpload(event) {
        if (!event) {
            const input = document.getElementById('file-input');
            input.click();
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        const textArea = document.getElementById('file-text');
        const contentArea = document.getElementById('file-content-area');
        const statusEl = document.getElementById('file-parse-status');
        const nameInput = document.getElementById('import-file-bank-name');

        state.lastImportedFileType = 'document';
        state.lastImportedImageName = '';

        if (!nameInput.value.trim()) {
            nameInput.value = file.name.replace(/\.[^.]+$/, '');
        }

        textArea.value = '';
        contentArea.style.display = 'block';
        if (statusEl) {
            statusEl.textContent = `正在解析文件：${file.name}`;
        }

        try {
            if (typeof FileParser === 'undefined') {
                throw new Error('文档解析模块未加载');
            }
            if (!FileParser.isSupported(file)) {
                throw new Error('不支持该文件格式，请上传 txt/docx/doc/pdf/xlsx/xls/csv 文件');
            }

            const text = await FileParser.parseFile(file);
            textArea.value = text;

            const pkg = Storage.parseBankPackage(text);
            if (pkg) {
                document.getElementById('import-bank-name').dataset.importPackage = 'true';
                document.getElementById('import-bank-name').value = pkg.bank.name || nameInput.value.trim();
                document.getElementById('import-bank-desc').value = pkg.bank.description || '';
            } else {
                document.getElementById('import-bank-name').dataset.importPackage = '';
            }

            if (statusEl) {
                const lineCount = text ? text.split(/\n/).filter(Boolean).length : 0;
                statusEl.textContent = pkg
                    ? `已识别题库互通包：${file.name}，包含 ${pkg.bank.questions.length} 道题目及学习统计`
                    : `解析完成：${file.name}，提取到 ${text.length} 个字符 / ${lineCount} 行文本`;
            }
        } catch (error) {
            textArea.value = '';
            if (statusEl) {
                statusEl.textContent = `解析失败：${error.message}`;
            }
            showToast(error.message || '文件解析失败');
        }
    }

    async function handleImageUpload(event) {
        if (!event) {
            const input = document.getElementById('image-input');
            if (input) input.click();
            return;
        }

        const file = event.target.files[0];
        if (!file) return;

        const settings = Storage.getSettings();
        const textArea = document.getElementById('import-text');
        const statusEl = document.getElementById('file-parse-status');
        const contentArea = document.getElementById('file-content-area');
        const fileText = document.getElementById('file-text');
        const fileNameInput = document.getElementById('import-file-bank-name');

        state.lastImportedFileType = 'image';
        state.lastImportedImageName = file.name;

        if (!settings.aiEnabled) {
            showToast('请先在设置中开启 AI 功能后再使用 OCR 图片识题');
            return;
        }

        if (!fileNameInput.value.trim()) {
            fileNameInput.value = file.name.replace(/\.[^.]+$/, '');
        }

        if (statusEl) {
            statusEl.textContent = `正在识别图片：${file.name}`;
        }
        contentArea.style.display = 'block';
        fileText.value = '';

        try {
            showToast('AI 正在识别图片中的题目...');
            const questions = await AiService.ocrQuestionsFromImage(file, file.type || 'image/*');
            if (!questions.length) {
                throw new Error('图片中未识别到题目');
            }

            const mergedText = questions.map(formatQuestionForText).join('\n\n');
            textArea.value = mergedText;
            fileText.value = mergedText;
            document.getElementById('import-bank-name').value = fileNameInput.value.trim();
            state.previewQuestions = questions;
            renderPreview(questions);

            if (statusEl) {
                statusEl.textContent = `OCR 识别完成：${file.name}，识别到 ${questions.length} 道题目`;
            }
            showToast(`OCR 识别完成，共 ${questions.length} 道题`);
        } catch (error) {
            if (statusEl) {
                statusEl.textContent = `OCR 识别失败：${error.message}`;
            }
            showToast(error.message || '图片识别失败');
        }
    }

    // ==================== 背题模式 ====================

    function startStudy(type) {
        const bank = Storage.getBank(state.currentBankId);
        if (!bank || bank.questions.length === 0) {
            showToast('题库中没有题目');
            return;
        }

        let questions = [...bank.questions];
        if (type) {
            questions = questions.filter(q => q.type === type);
            if (questions.length === 0) {
                showToast(`${Storage.getQuestionTypeName(type)}暂无题目`);
                return;
            }
        }

        const settings = Storage.getSettings();
        if (settings.studyShuffle) {
            shuffle(questions);
        }

        state.currentStudyType = type || '';
        state.studyQuestions = questions;
        state.studyIndex = 0;
        state.studyFlipped = false;

        navigateTo('study');
        renderStudyCard();
    }

    function startStudyByType(type) {
        startStudy(type);
    }

    function renderStudyCard() {
        const questions = state.studyQuestions;
        const idx = state.studyIndex;
        const q = questions[idx];

        if (!q) return;

        const progress = ((idx + 1) / questions.length * 100).toFixed(0);
        document.getElementById('study-progress-text').textContent = `${idx + 1} / ${questions.length}`;
        document.getElementById('study-percent').textContent = progress + '%';
        document.getElementById('study-progress-fill').style.width = progress + '%';

        const typeEl = document.getElementById('study-q-type');
        typeEl.textContent = Storage.getQuestionTypeName(q.type);
        typeEl.className = 'question-type-badge ' + q.type;

        document.getElementById('study-question').textContent = q.content;

        const optionsEl = document.getElementById('study-options');
        if (q.options && q.options.length > 0) {
            const labels = 'ABCDEFGHIJ';
            optionsEl.innerHTML = q.options.map((opt, i) => `
                <div class="study-option"><span style="font-weight:600;color:var(--primary);">${labels[i]}.</span> ${escapeHtml(opt)}</div>
            `).join('');
        } else {
            optionsEl.innerHTML = '';
        }

        document.getElementById('study-answer').textContent = q.answer;
        document.getElementById('study-explanation').textContent = q.explanation || '暂无解析';

        const markBtn = document.getElementById('study-mark-btn');
        const markText = document.getElementById('study-mark-text');
        if (q.mastered) {
            markBtn.classList.add('marked');
            markText.textContent = '已掌握';
        } else {
            markBtn.classList.remove('marked');
            markText.textContent = '标记掌握';
        }

        Storage.markStudied(state.currentBankId, q.id, true);

        document.querySelector('.study-nav-btn[onclick="App.prevStudyCard()"]').disabled = idx === 0;
        document.querySelector('.study-nav-btn[onclick="App.nextStudyCard()"]').disabled = idx === questions.length - 1;
    }

    function nextStudyCard() {
        if (state.studyIndex < state.studyQuestions.length - 1) {
            state.studyIndex++;
            renderStudyCard();
        } else {
            showToast('已经是最后一题了');
        }
    }

    function prevStudyCard() {
        if (state.studyIndex > 0) {
            state.studyIndex--;
            renderStudyCard();
        }
    }

    function toggleMastered() {
        const q = state.studyQuestions[state.studyIndex];
        if (!q) return;
        const newMastered = !q.mastered;
        Storage.markMastered(state.currentBankId, q.id, newMastered);
        q.mastered = newMastered;

        const markBtn = document.getElementById('study-mark-btn');
        const markText = document.getElementById('study-mark-text');
        if (newMastered) {
            markBtn.classList.add('marked');
            markText.textContent = '已掌握';
            showToast('已标记为掌握');
        } else {
            markBtn.classList.remove('marked');
            markText.textContent = '标记掌握';
        }
    }

    function toggleStudySettings() {
        showToast('请在设置中调整背题选项');
    }

    function exitStudy() {
        backToHome();
    }

    // ==================== 刷题模式 ====================

    function startPractice(wrongOnly, type) {
        wrongOnly = wrongOnly || false;
        const bank = Storage.getBank(state.currentBankId);
        if (!bank || bank.questions.length === 0) {
            showToast('题库中没有题目');
            return;
        }

        let questions;
        if (wrongOnly) {
            const errors = Storage.getErrorsByBank(state.currentBankId);
            if (errors.length === 0) {
                showToast('没有错题可练习');
                return;
            }
            questions = errors.map(e => e.question).filter(q => q);
        } else {
            questions = [...bank.questions];
        }

        if (type) {
            questions = questions.filter(q => q.type === type);
            if (questions.length === 0) {
                showToast(`${Storage.getQuestionTypeName(type)}暂无可练习题目`);
                return;
            }
        }

        state.practiceSessionKey = state.currentBankId || '';
        const session = Storage.getPracticeSession(state.currentBankId);
        const canResume = session
            && session.mode !== 'error-book'
            && session.wrongOnly === wrongOnly
            && (session.type || '') === (type || '')
            && Array.isArray(session.questions)
            && session.questions.length > 0;

        if (canResume) {
            showConfirm('继续上次刷题', `检测到你上次练到了第 ${Math.min((session.index || 0) + 1, session.questions.length)} 题，是否继续？`, function() {
                resumePracticeSession(session, bank);
            });
            return;
        }

        setupPracticeSession({
            bank,
            questions,
            wrongOnly,
            type,
            mode: wrongOnly ? 'wrong-only' : 'normal'
        });
    }

    function startPracticeByType(type) {
        startPractice(false, type);
    }

    function setupPracticeSession(options) {
        const settings = Storage.getSettings();
        let questions = (options.questions || []).map(q => q);
        if (settings.practiceShuffle) {
            questions = shuffle(questions);
        }

        state.currentPracticeType = options.type || '';
        state.practiceQuestions = questions;
        state.practiceIndex = 0;
        state.practiceAnswers = {};
        state.practiceResults = [];
        state.practiceScore = 0;
        state.practiceWrongOnly = !!options.wrongOnly;
        state.practiceBankMap = options.practiceBankMap || {};
        state.errorPracticeMode = options.mode === 'error-book';
        state.favoritePracticeMode = !!options.favoriteMode;
        state.practiceSessionKey = options.sessionKey || state.currentBankId || '';
        state.practiceSessionMode = options.mode || 'normal';
        state.practiceFinishedQuestions = {};

        navigateTo('practice');
        renderPracticeQuestion();
    }

    function resumePracticeSession(session, bank) {
        const questionIds = session.questions || [];
        const practiceQuestions = questionIds
            .map(id => bank.questions.find(q => q.id === id))
            .filter(Boolean);

        if (!practiceQuestions.length) {
            Storage.clearPracticeSession(state.currentBankId);
            showToast('上次保存的刷题进度已失效，已为你重新开始');
            startPractice(!!session.wrongOnly, session.type || '');
            return;
        }

        state.currentPracticeType = session.type || '';
        state.practiceQuestions = practiceQuestions;
        state.practiceIndex = Math.min(session.index || 0, practiceQuestions.length - 1);
        state.practiceAnswers = session.answers || {};
        state.practiceResults = session.results || [];
        state.practiceScore = session.score || 0;
        state.practiceWrongOnly = !!session.wrongOnly;
        state.practiceBankMap = session.practiceBankMap || {};
        state.errorPracticeMode = false;
        state.favoritePracticeMode = session.mode === 'favorites';
        state.practiceSessionKey = state.currentBankId || '';
        state.practiceSessionMode = 'resume';
        state.practiceFinishedQuestions = buildFinishedMap(state.practiceResults);

        navigateTo('practice');
        renderPracticeQuestion();
        showToast('已恢复上次刷题进度');
    }

    function buildFinishedMap(results) {
        const map = {};
        (results || []).forEach(item => {
            if (item && item.questionId) {
                map[item.questionId] = true;
            }
        });
        return map;
    }

    function resumeFavoritePracticeSession(session) {
        const favorites = Storage.getAllFavorites();
        const favoriteQuestionMap = new Map();
        favorites.forEach(item => {
            favoriteQuestionMap.set(item.question.id, item.question);
        });

        const questionIds = session.questions || [];
        const practiceQuestions = questionIds.map(id => favoriteQuestionMap.get(id)).filter(Boolean);
        if (!practiceQuestions.length) {
            Storage.clearGenericPracticeSession(state.practiceSessionKey);
            showToast('上次保存的收藏练习进度已失效，已为你重新开始');
            startFavoritePractice();
            return;
        }

        state.currentPracticeType = session.type || '';
        state.practiceQuestions = practiceQuestions;
        state.practiceIndex = Math.min(session.index || 0, practiceQuestions.length - 1);
        state.practiceAnswers = session.answers || {};
        state.practiceResults = session.results || [];
        state.practiceScore = session.score || 0;
        state.practiceWrongOnly = !!session.wrongOnly;
        state.practiceBankMap = session.practiceBankMap || {};
        state.errorPracticeMode = false;
        state.favoritePracticeMode = true;
        state.practiceSessionMode = 'resume';
        state.practiceFinishedQuestions = buildFinishedMap(state.practiceResults);

        navigateTo('practice');
        renderPracticeQuestion();
        showToast('已恢复上次收藏练习进度');
    }

    function renderPracticeQuestion() {
        const questions = state.practiceQuestions;
        const idx = state.practiceIndex;
        const q = questions[idx];

        if (!q) {
            finishPractice();
            return;
        }

        const progress = ((idx) / questions.length * 100).toFixed(0);
        document.getElementById('practice-progress-text').textContent = `第 ${idx + 1} 题 / 共 ${questions.length} 题`;
        const correctCount = state.practiceResults.filter(r => r.correct).length;
        const answeredCount = state.practiceResults.length;
        const rate = answeredCount > 0 ? Math.round(correctCount / answeredCount * 100) : 0;
        document.getElementById('practice-correct-rate').textContent = `正确率 ${rate}%`;
        document.getElementById('practice-progress-fill').style.width = progress + '%';
        document.getElementById('practice-score').textContent = state.practiceScore + '分';

        const typeEl = document.getElementById('practice-q-type');
        typeEl.textContent = Storage.getQuestionTypeName(q.type);
        typeEl.className = 'question-type-badge ' + q.type;

        document.getElementById('practice-question').textContent = q.content;
        document.getElementById('practice-feedback').style.display = 'none';
        document.getElementById('practice-submit-btn').style.display = '';
        document.getElementById('practice-next-btn').style.display = 'none';

        const favoriteBtn = document.getElementById('practice-favorite-btn');
        favoriteBtn.textContent = q.favorite ? '★ 已收藏' : '☆ 收藏';
        favoriteBtn.classList.toggle('active', !!q.favorite);

        const favoriteTag = document.getElementById('practice-favorite-mode-tag');
        if (favoriteTag) {
            favoriteTag.style.display = state.favoritePracticeMode ? 'inline-flex' : 'none';
        }

        const currentBankId = state.practiceBankMap[q.id] || state.currentBankId;
        const isInErrorBook = Storage.getErrorBook().some(item => item.bankId === currentBankId && item.questionId === q.id);
        const errorBtn = document.getElementById('practice-error-btn');
        errorBtn.textContent = isInErrorBook ? '✓ 在错题本' : '＋ 错题本';
        errorBtn.classList.toggle('error-active', isInErrorBook);

        const saveBtn = document.getElementById('practice-save-btn');
        saveBtn.classList.remove('saved');
        saveBtn.textContent = '💾 保存';

        document.getElementById('practice-prev-btn').disabled = idx === 0;
        document.getElementById('practice-next-direct-btn').disabled = idx >= questions.length - 1;

        const optionsEl = document.getElementById('practice-options');
        const settings = Storage.getSettings();
        const savedAnswer = state.practiceAnswers[q.id] || '';

        if (q.type === 'single' || q.type === 'multiple') {
            let options = [...q.options];
            let optionLabels = 'ABCDEFGHIJ'.slice(0, options.length).split('');
            if (settings.optionShuffle) {
                const shuffled = options.map((opt, i) => ({ opt, label: optionLabels[i] }));
                shuffle(shuffled);
                options = shuffled.map(s => s.opt);
                optionLabels = shuffled.map(s => s.label);
            }

            const isMultiple = q.type === 'multiple';
            optionsEl.innerHTML = options.map((opt, i) => {
                const selected = isMultiple
                    ? savedAnswer.includes(optionLabels[i])
                    : savedAnswer === optionLabels[i];
                return `
                    <div class="practice-option ${selected ? 'selected' : ''}" data-label="${optionLabels[i]}" data-value="${escapeAttr(opt)}" onclick="App.selectOption(this, ${isMultiple})">
                        <span class="option-label">${optionLabels[i]}</span>
                        <span class="option-text">${escapeHtml(opt)}</span>
                    </div>
                `;
            }).join('');
        } else if (q.type === 'truefalse') {
            optionsEl.innerHTML = `
                <div class="practice-truefalse">
                    <div class="practice-option ${savedAnswer === '正确' ? 'selected' : ''}" data-value="正确" onclick="App.selectTrueFalse(this)">
                        <span class="option-text">✓ 正确</span>
                    </div>
                    <div class="practice-option ${savedAnswer === '错误' ? 'selected' : ''}" data-value="错误" onclick="App.selectTrueFalse(this)">
                        <span class="option-text">✗ 错误</span>
                    </div>
                </div>
            `;
        } else {
            const isFill = q.type === 'fillblank';
            optionsEl.innerHTML = `
                <div class="practice-input-area">
                    ${isFill
                        ? `<input type="text" class="practice-input" id="practice-text-input" placeholder="请输入答案" value="${escapeAttr(savedAnswer)}">`
                        : `<textarea class="practice-input" id="practice-text-input" rows="4" placeholder="请输入答案" style="resize:vertical;">${escapeHtml(savedAnswer)}</textarea>`
                    }
                    <div class="practice-session-tip">当前输入会在保存进度时保留</div>
                </div>
            `;
        }
    }

    function selectOption(el, isMultiple) {
        if (isMultiple) {
            el.classList.toggle('selected');
        } else {
            el.parentElement.querySelectorAll('.practice-option').forEach(o => o.classList.remove('selected'));
            el.classList.add('selected');
        }
        persistCurrentPracticeAnswer();
    }

    function selectTrueFalse(el) {
        el.parentElement.querySelectorAll('.practice-option').forEach(o => o.classList.remove('selected'));
        el.classList.add('selected');
        persistCurrentPracticeAnswer();
    }

    async function practiceSubmit() {
        const q = state.practiceQuestions[state.practiceIndex];
        if (!q || state.practiceSubmitting) return;
        if (state.practiceFinishedQuestions[q.id]) {
            showToast('这道题已经作答，可直接切换上下题');
            return;
        }

        let userAnswer = '';
        const settings = Storage.getSettings();

        if (q.type === 'single') {
            const selected = document.querySelector('.practice-option.selected');
            if (!selected) {
                showToast('请选择一个答案');
                return;
            }
            userAnswer = selected.dataset.label;
        } else if (q.type === 'multiple') {
            const selected = document.querySelectorAll('.practice-option.selected');
            if (selected.length === 0) {
                showToast('请至少选择一个答案');
                return;
            }
            userAnswer = Array.from(selected).map(s => s.dataset.label).sort().join('');
        } else if (q.type === 'truefalse') {
            const selected = document.querySelector('.practice-option.selected');
            if (!selected) {
                showToast('请选择答案');
                return;
            }
            userAnswer = selected.dataset.value;
        } else {
            const input = document.getElementById('practice-text-input');
            if (!input || !input.value.trim()) {
                showToast('请输入答案');
                return;
            }
            userAnswer = input.value.trim();
        }

        state.practiceAnswers[q.id] = userAnswer;
        state.practiceSubmitting = true;
        let correct = checkAnswer(q, userAnswer);
        let aiReason = '';
        let aiScore = correct ? 1 : 0;

        if (!correct && (q.type === 'fillblank' || q.type === 'shortanswer') && settings.aiEnabled && settings.aiUseForSubjectiveGrading) {
            try {
                showToast('AI 正在进行语义判分...');
                const result = await AiService.gradeSubjectiveAnswer(q, userAnswer);
                correct = !!result.correct;
                aiReason = result.reason || '';
                aiScore = typeof result.score === 'number' ? result.score : (correct ? 1 : 0);
            } catch (error) {
                if (settings.aiAutoFallback) {
                    aiReason = 'AI 判分失败，已回退为普通字符串判分';
                    showToast('AI 判分失败，已自动回退普通判分');
                } else {
                    state.practiceSubmitting = false;
                    showToast(error.message || 'AI 判分失败');
                    return;
                }
            }
        }

        const resultRecord = {
            questionId: q.id,
            correct: correct,
            userAnswer: userAnswer,
            skipped: false,
            aiReason,
            aiScore
        };
        state.practiceResults.push(resultRecord);
        state.practiceFinishedQuestions[q.id] = true;

        if (correct) {
            state.practiceScore += Math.round(100 / state.practiceQuestions.length);
            if (state.practiceWrongOnly) {
                const bankId = state.practiceBankMap[q.id] || state.currentBankId;
                Storage.removeErrorByQuestion(bankId, q.id);
            }
        } else {
            if (settings.autoError) {
                const bankId = state.practiceBankMap[q.id] || state.currentBankId;
                Storage.addError(bankId, q.id, userAnswer);
            }
        }

        showPracticeFeedback(q, userAnswer, correct, aiReason, aiScore);
        document.querySelectorAll('.practice-option, .practice-input').forEach(el => {
            el.classList.add('disabled');
            el.style.pointerEvents = 'none';
        });

        if (q.type === 'single' || q.type === 'multiple') {
            const correctAnswer = q.answer;
            document.querySelectorAll('.practice-option').forEach(el => {
                if (correctAnswer.includes(el.dataset.label)) {
                    el.classList.add('correct');
                }
                if (el.classList.contains('selected') && !correctAnswer.includes(el.dataset.label)) {
                    el.classList.add('wrong');
                }
            });
        } else if (q.type === 'truefalse') {
            document.querySelectorAll('.practice-option').forEach(el => {
                if (el.dataset.value === q.answer) {
                    el.classList.add('correct');
                }
                if (el.classList.contains('selected') && el.dataset.value !== q.answer) {
                    el.classList.add('wrong');
                }
            });
        } else {
            const input = document.getElementById('practice-text-input');
            if (input) {
                input.classList.add(correct ? 'correct' : 'wrong');
            }
        }

        document.getElementById('practice-submit-btn').style.display = 'none';
        document.getElementById('practice-next-btn').style.display = '';
        state.practiceSubmitting = false;
        savePracticeProgress(false, true);
    }

    function showPracticeFeedback(q, userAnswer, correct, aiReason, aiScore) {
        const feedbackEl = document.getElementById('practice-feedback');
        feedbackEl.style.display = 'block';
        feedbackEl.style.background = correct ? 'var(--success-bg)' : 'var(--error-bg)';

        const answerEl = document.getElementById('practice-correct-answer');
        const explanationEl = document.getElementById('practice-explanation');
        answerEl.innerHTML = escapeHtml(q.answer);
        explanationEl.textContent = q.explanation || '暂无解析';

        const settings = Storage.getSettings();
        if (!q.explanation && settings.aiEnabled && settings.aiUseForExplanation) {
            explanationEl.textContent = '可在编辑页点击“AI 生成解析”补全本题解析';
        }

        if (!correct) {
            answerEl.innerHTML += `<div style="font-size:13px;color:var(--error);margin-top:4px;">你的答案：${escapeHtml(userAnswer)}</div>`;
        }

        if (aiReason) {
            explanationEl.innerHTML += `<div style="margin-top:8px;font-size:12px;color:var(--text-secondary);">AI 判分说明：${escapeHtml(aiReason)}${typeof aiScore === 'number' ? `（评分 ${Math.round(aiScore * 100)}%）` : ''}</div>`;
        }
    }

    function checkAnswer(q, userAnswer) {
        if (q.type === 'single' || q.type === 'multiple') {
            return userAnswer.toUpperCase() === q.answer.toUpperCase();
        } else if (q.type === 'truefalse') {
            return userAnswer === q.answer;
        } else {
            // 填空/简答：模糊匹配
            const normalize = s => s.trim().toLowerCase().replace(/\s+/g, '');
            return normalize(userAnswer) === normalize(q.answer);
        }
    }

    function practiceSkip() {
        const q = state.practiceQuestions[state.practiceIndex];
        if (!q) return;
        if (!state.practiceFinishedQuestions[q.id]) {
            state.practiceResults.push({
                questionId: q.id,
                correct: false,
                userAnswer: '',
                skipped: true
            });
            state.practiceFinishedQuestions[q.id] = true;
        }
        practiceNext();
    }

    function practicePrev() {
        persistCurrentPracticeAnswer();
        if (state.practiceIndex > 0) {
            state.practiceIndex--;
            renderPracticeQuestion();
        }
    }

    function practiceNextDirect() {
        persistCurrentPracticeAnswer();
        if (state.practiceIndex >= state.practiceQuestions.length - 1) {
            showToast('已经是最后一题了');
            return;
        }
        state.practiceIndex++;
        renderPracticeQuestion();
    }

    function practiceNext() {
        persistCurrentPracticeAnswer();
        state.practiceIndex++;
        if (state.practiceIndex >= state.practiceQuestions.length) {
            finishPractice();
        } else {
            renderPracticeQuestion();
        }
    }

    function togglePracticeFavorite() {
        const q = state.practiceQuestions[state.practiceIndex];
        if (!q) return;
        const bankId = state.practiceBankMap[q.id] || state.currentBankId;
        const favorite = Storage.toggleFavorite(bankId, q.id);
        q.favorite = favorite;
        const btn = document.getElementById('practice-favorite-btn');
        btn.textContent = favorite ? '★ 已收藏' : '☆ 收藏';
        btn.classList.toggle('active', favorite);
        if (state.favoritePracticeMode && !favorite) {
            showToast('已取消收藏，当前题仍可继续完成本次练习');
            return;
        }
        showToast(favorite ? '已加入收藏' : '已取消收藏');
        if (state.currentView === 'favorites') {
            renderFavorites();
        }
    }

    function addCurrentToErrorBook() {
        const q = state.practiceQuestions[state.practiceIndex];
        if (!q) return;
        const bankId = state.practiceBankMap[q.id] || state.currentBankId;
        const answer = collectCurrentAnswerForSave();
        Storage.addError(bankId, q.id, answer);
        const btn = document.getElementById('practice-error-btn');
        btn.textContent = '✓ 在错题本';
        btn.classList.add('error-active');
        showToast('已加入错题本');
    }

    function persistCurrentPracticeAnswer() {
        const q = state.practiceQuestions[state.practiceIndex];
        if (!q) return;
        const answer = collectCurrentAnswerForSave();
        if (answer) {
            state.practiceAnswers[q.id] = answer;
        }
    }

    function collectCurrentAnswerForSave() {
        const q = state.practiceQuestions[state.practiceIndex];
        if (!q) return '';

        if (q.type === 'single') {
            const selected = document.querySelector('.practice-option.selected');
            return selected ? selected.dataset.label : '';
        }
        if (q.type === 'multiple') {
            const selected = document.querySelectorAll('.practice-option.selected');
            return selected.length ? Array.from(selected).map(s => s.dataset.label).sort().join('') : '';
        }
        if (q.type === 'truefalse') {
            const selected = document.querySelector('.practice-option.selected');
            return selected ? selected.dataset.value : '';
        }
        const input = document.getElementById('practice-text-input');
        return input ? input.value.trim() : '';
    }

    function savePracticeProgress(exitAfterSave, silent) {
        persistCurrentPracticeAnswer();
        const bankId = state.currentBankId;
        if (!bankId || !state.practiceQuestions.length) {
            if (!silent) showToast('当前没有可保存的刷题进度');
            return false;
        }

        const sessionPayload = {
            mode: state.errorPracticeMode ? 'error-book' : state.practiceSessionMode,
            wrongOnly: state.practiceWrongOnly,
            type: state.currentPracticeType || '',
            questions: state.practiceQuestions.map(q => q.id),
            index: state.practiceIndex,
            answers: state.practiceAnswers,
            results: state.practiceResults,
            score: state.practiceScore,
            practiceBankMap: state.practiceBankMap
        };

        if (state.favoritePracticeMode) {
            Storage.saveGenericPracticeSession(state.practiceSessionKey || 'favorites-session', sessionPayload);
        } else {
            Storage.savePracticeSession(bankId, sessionPayload);
        }

        const btn = document.getElementById('practice-save-btn');
        if (btn) {
            btn.textContent = '✓ 已保存';
            btn.classList.add('saved');
        }
        if (!silent) {
            showToast(exitAfterSave ? '进度已保存，稍后可继续刷题' : '刷题进度已保存');
        }
        if (exitAfterSave) {
            backToHome();
        }
        return true;
    }

    function finishPractice() {
        const total = state.practiceQuestions.length;
        const correct = state.practiceResults.filter(r => r.correct).length;
        const wrong = state.practiceResults.filter(r => !r.correct && !r.skipped).length;
        const skip = state.practiceResults.filter(r => r.skipped).length;
        const bankBreakdown = {};

        state.practiceQuestions.forEach(question => {
            const bankId = state.practiceBankMap[question.id] || state.currentBankId;
            if (!bankId) return;
            if (!bankBreakdown[bankId]) {
                bankBreakdown[bankId] = { practiced: 0, correct: 0 };
            }
            bankBreakdown[bankId].practiced += 1;
            const result = state.practiceResults.find(item => item.questionId === question.id);
            if (result && result.correct) {
                bankBreakdown[bankId].correct += 1;
            }
        });

        Storage.recordPractice(total, correct, {
            bankId: state.currentBankId,
            bankBreakdown
        });
        if (state.favoritePracticeMode) {
            Storage.clearGenericPracticeSession(state.practiceSessionKey || 'favorites-session');
        } else {
            Storage.clearPracticeSession(state.currentBankId);
        }

        document.getElementById('result-total').textContent = total;
        document.getElementById('result-correct').textContent = correct;
        document.getElementById('result-wrong').textContent = wrong;
        document.getElementById('result-skip').textContent = skip;
        document.getElementById('result-score-num').textContent = state.practiceScore;

        const circumference = 2 * Math.PI * 70;
        const offset = circumference * (1 - state.practiceScore / 100);
        document.getElementById('result-circle-fill').style.strokeDashoffset = offset;

        navigateTo('practice-result');
    }

    function practiceWrongOnly() {
        startPractice(true, state.currentPracticeType || '');
    }

    function exitPractice() {
        if (state.practiceQuestions.length) {
            showConfirm('退出刷题', '是否先保存当前刷题进度？', function() {
                savePracticeProgress(true);
            });
            return;
        }
        backToHome();
    }

    // ==================== 错题练习 ====================

    function startErrorPractice() {
        const errors = Storage.getErrorBook();
        if (errors.length === 0) {
            showToast('错题本为空');
            return;
        }

        const practiceBankMap = {};
        errors.forEach(e => {
            if (e.question) {
                practiceBankMap[e.question.id] = e.bankId;
            }
        });

        let questions = errors.map(e => e.question).filter(q => q);
        setupPracticeSession({
            bank: null,
            questions,
            wrongOnly: true,
            type: '',
            mode: 'error-book',
            practiceBankMap
        });
    }

    function startFavoritePractice() {
        const favorites = Storage.getAllFavorites();
        if (favorites.length === 0) {
            showToast('收藏夹为空');
            return;
        }

        state.practiceSessionKey = 'favorites-session';
        const session = Storage.getGenericPracticeSession(state.practiceSessionKey);
        const canResume = session
            && session.mode === 'favorites'
            && Array.isArray(session.questions)
            && session.questions.length > 0;

        if (canResume) {
            showConfirm('继续收藏练习', `检测到你上次练到了第 ${Math.min((session.index || 0) + 1, session.questions.length)} 题，是否继续？`, function() {
                resumeFavoritePracticeSession(session);
            });
            return;
        }

        const practiceBankMap = {};
        const questions = favorites.map(item => {
            practiceBankMap[item.question.id] = item.bankId;
            return item.question;
        });

        setupPracticeSession({
            bank: null,
            questions,
            wrongOnly: false,
            type: '',
            mode: 'favorites',
            practiceBankMap,
            favoriteMode: true,
            sessionKey: state.practiceSessionKey
        });
    }

    // ==================== 收藏夹 ====================

    function renderFavorites() {
        const favorites = Storage.getAllFavorites();
        const listEl = document.getElementById('favorite-list');
        const emptyEl = document.getElementById('favorite-empty');

        if (!favorites.length) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'flex';
            return;
        }

        emptyEl.style.display = 'none';
        listEl.innerHTML = favorites.map(item => `
            <div class="error-item">
                <div class="error-item-header">
                    <span class="error-item-bank">${escapeHtml(item.bankName)}</span>
                    <span class="question-item-type ${item.question.type}">${Storage.getQuestionTypeName(item.question.type)}</span>
                </div>
                <div class="error-item-q">${escapeHtml(item.question.content)}</div>
                <div class="error-item-answer error-item-correct">答案：${escapeHtml(item.question.answer)}</div>
                <div class="error-item-actions">
                    <button onclick="App.openBank('${item.bankId}')">查看题库</button>
                    <button onclick="App.removeFavorite('${item.bankId}', '${item.question.id}')">取消收藏</button>
                </div>
            </div>
        `).join('');
    }

    function removeFavorite(bankId, questionId) {
        const favorite = Storage.setFavorite(bankId, questionId, false);
        if (favorite === false) {
            showToast('已取消收藏');
        }
        renderFavorites();
    }

    // ==================== 错题本 ====================

    function renderErrorBook() {
        const errors = Storage.getErrorBook();
        const listEl = document.getElementById('error-list');
        const emptyEl = document.getElementById('error-empty');

        // 更新筛选器
        const filterSelect = document.getElementById('error-filter-bank');
        const currentFilter = filterSelect.value;
        const banks = Storage.getAllBanks();
        filterSelect.innerHTML = '<option value="">全部题库</option>' +
            banks.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
        filterSelect.value = currentFilter;

        if (errors.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'flex';
            return;
        }

        emptyEl.style.display = 'none';
        const filterBankId = filterSelect.value;
        const filtered = filterBankId ? errors.filter(e => e.bankId === filterBankId) : errors;

        if (filtered.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><p>该题库暂无错题</p></div>`;
            return;
        }

        listEl.innerHTML = filtered.map(e => `
            <div class="error-item">
                <div class="error-item-header">
                    <span class="error-item-bank">${escapeHtml(e.bankName)}</span>
                    <span class="question-item-type ${e.question.type}">${Storage.getQuestionTypeName(e.question.type)}</span>
                </div>
                <div class="error-item-q">${escapeHtml(e.question.content)}</div>
                <div class="error-item-answer error-item-wrong">你的答案：${escapeHtml(e.wrongAnswer || '未作答')}</div>
                <div class="error-item-answer error-item-correct">正确答案：${escapeHtml(e.question.answer)}</div>
                <div class="error-item-actions">
                    <button onclick="App.removeError('${e.id}')">移除</button>
                    <button onclick="App.openBank('${e.bankId}')">查看题库</button>
                </div>
            </div>
        `).join('');
    }

    function filterErrors() {
        renderErrorBook();
    }

    function removeError(errorId) {
        Storage.removeError(errorId);
        showToast('已从错题本移除');
        renderErrorBook();
    }

    function clearAllErrors() {
        const errors = Storage.getErrorBook();
        if (errors.length === 0) {
            showToast('错题本已经是空的');
            return;
        }
        showConfirm('清空错题本', '确定要清空所有错题记录吗？此操作不可撤销。', function() {
            Storage.clearAllErrors();
            showToast('错题本已清空');
            renderErrorBook();
        });
    }

    // ==================== 统计 ====================

    function renderStats() {
        const stats = Storage.getStats();

        document.getElementById('stats-total-q').textContent = stats.totalQuestions;
        document.getElementById('stats-mastered').textContent = stats.totalMastered;
        document.getElementById('stats-practiced').textContent = stats.totalPracticed;
        document.getElementById('stats-errors').textContent = stats.errorCount;
        const overallRateEl = document.getElementById('stats-overall-rate');
        if (overallRateEl) {
            overallRateEl.textContent = stats.overallRate + '%';
        }

        // 题库概览
        const banks = Storage.getAllBanks();
        const bankListEl = document.getElementById('stats-bank-list');
        if (banks.length === 0) {
            bankListEl.innerHTML = '<div class="empty-state"><p>暂无题库</p></div>';
        } else {
            bankListEl.innerHTML = banks.map(b => {
                const rate = b.questionCount > 0 ? Math.round(b.masteredCount / b.questionCount * 100) : 0;
                const bankStats = Storage.getBankStudyStats(b.id);
                const accuracy = bankStats ? bankStats.accuracy : 0;
                const practiced = bankStats ? bankStats.totalPracticed : 0;
                return `
                    <div class="stats-bank-item">
                        <div class="stats-bank-name">${escapeHtml(b.name)}</div>
                        <div class="stats-bank-bar">
                            <div class="stats-bank-bar-fill" style="width:${rate}%"></div>
                        </div>
                        <div class="stats-bank-info">
                            <span>掌握 ${b.masteredCount}/${b.questionCount}</span>
                            <span>${rate}%</span>
                        </div>
                        <div class="stats-bank-info" style="margin-top:6px;">
                            <span>刷题 ${practiced} 次</span>
                            <span>正确率 ${accuracy}%</span>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 正确率趋势图
        const history = Storage.getRecentHistory(7);
        const chartEl = document.getElementById('stats-chart');
        const hasData = history.some(h => h.practiced > 0);

        if (!hasData) {
            chartEl.innerHTML = '<div class="chart-empty">暂无刷题记录</div>';
        } else {
            const maxVal = Math.max(...history.map(h => h.practiced), 1);
            chartEl.innerHTML = `
                <div class="chart-bars">
                    ${history.map(h => {
                        const height = h.practiced > 0 ? (h.practiced / maxVal * 100) : 2;
                        const date = new Date(h.date);
                        const label = (date.getMonth() + 1) + '/' + date.getDate();
                        return `
                            <div class="chart-bar-col">
                                <span class="chart-bar-val">${h.practiced > 0 ? h.rate + '%' : '-'}</span>
                                <div class="chart-bar" style="height:${height}%"></div>
                                <span class="chart-bar-label">${label}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }
    }

    // ==================== 设置 ====================

    function renderSettings() {
        const settings = Storage.getSettings();
        document.getElementById('setting-study-shuffle').checked = settings.studyShuffle;
        document.getElementById('setting-practice-shuffle').checked = settings.practiceShuffle;
        document.getElementById('setting-option-shuffle').checked = settings.optionShuffle;
        document.getElementById('setting-auto-error').checked = settings.autoError;
        document.getElementById('setting-show-explanation').checked = settings.showExplanation;
        document.getElementById('setting-ai-enabled').checked = !!settings.aiEnabled;
        document.getElementById('setting-ai-base-url').value = settings.aiBaseUrl || '';
        document.getElementById('setting-ai-api-key').value = settings.aiApiKey || '';
        document.getElementById('setting-ai-model').value = settings.aiModel || '';
        document.getElementById('setting-ai-use-import').checked = !!settings.aiUseForImport;
        document.getElementById('setting-ai-use-explanation').checked = !!settings.aiUseForExplanation;
        document.getElementById('setting-ai-auto-explain-import').checked = !!settings.aiAutoExplainAfterImport;
        document.getElementById('setting-ai-subjective-grade').checked = !!settings.aiUseForSubjectiveGrading;
        document.getElementById('setting-ai-auto-fallback').checked = !!settings.aiAutoFallback;
        const resultEl = document.getElementById('ai-test-result');
        if (resultEl) resultEl.textContent = '';
    }

    function updateSettings() {
        Storage.updateSettings({
            studyShuffle: document.getElementById('setting-study-shuffle').checked,
            practiceShuffle: document.getElementById('setting-practice-shuffle').checked,
            optionShuffle: document.getElementById('setting-option-shuffle').checked,
            autoError: document.getElementById('setting-auto-error').checked,
            showExplanation: document.getElementById('setting-show-explanation').checked,
            aiEnabled: document.getElementById('setting-ai-enabled').checked,
            aiBaseUrl: document.getElementById('setting-ai-base-url').value.trim(),
            aiApiKey: document.getElementById('setting-ai-api-key').value.trim(),
            aiModel: document.getElementById('setting-ai-model').value.trim(),
            aiUseForImport: document.getElementById('setting-ai-use-import').checked,
            aiUseForExplanation: document.getElementById('setting-ai-use-explanation').checked,
            aiAutoExplainAfterImport: document.getElementById('setting-ai-auto-explain-import').checked,
            aiUseForSubjectiveGrading: document.getElementById('setting-ai-subjective-grade').checked,
            aiAutoFallback: document.getElementById('setting-ai-auto-fallback').checked
        });
    }

    async function testAiConnection() {
        const resultEl = document.getElementById('ai-test-result');
        if (resultEl) resultEl.textContent = '正在测试 AI 接口...';
        try {
            const result = await AiService.testConnection();
            if (resultEl) resultEl.textContent = result.message || 'AI 接口可用';
            showToast('AI 接口测试成功');
        } catch (error) {
            if (resultEl) resultEl.textContent = error.message || 'AI 接口测试失败';
            showToast(error.message || 'AI 接口测试失败');
        }
    }

    function exportData() {
        const data = Storage.exportData();
        const date = new Date().toISOString().split('T')[0];
        downloadFile(`题库大师_备份_${date}.json`, data);
        showToast('数据已导出');
    }

    function importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.qbank';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                const content = ev.target.result;
                const pkg = Storage.parseBankPackage(content);
                if (pkg) {
                    showConfirm('导入题库互通包', '将新增一个题库，并同步其学习统计、错题记录与续答进度，确定继续吗？', function() {
                        const result = Storage.importBankPackage(content);
                        showToast(result.message);
                        if (result.success) {
                            renderSettings();
                            renderBankList();
                            renderStats();
                        }
                    });
                    return;
                }

                showConfirm('导入数据', '导入将覆盖当前所有数据，确定继续吗？', function() {
                    const result = Storage.importData(content);
                    showToast(result.message);
                    if (result.success) {
                        renderSettings();
                        renderBankList();
                        renderStats();
                    }
                });
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function clearAllData() {
        showConfirm('清空所有数据', '⚠️ 此操作将删除所有题库、题目、错题记录和统计数据，且不可恢复！确定要继续吗？', function() {
            Storage.clearAllData();
            showToast('所有数据已清空');
            navigate('home');
        });
    }

    // ==================== 编辑题目 ====================

    function showAddQuestion() {
        state.editingQuestionId = null;
        state.editOptions = [];
        document.getElementById('edit-q-title').textContent = '添加题目';
        document.getElementById('edit-q-type').value = 'single';
        document.getElementById('edit-q-content').value = '';
        document.getElementById('edit-q-answer').value = '';
        document.getElementById('edit-q-explanation').value = '';
        renderEditOptions();
        onQuestionTypeChange();
        navigateTo('edit-question');
    }

    function showEditQuestion(bankId, questionId) {
        const q = Storage.getQuestion(bankId, questionId);
        if (!q) return;
        state.currentBankId = bankId;
        state.editingQuestionId = questionId;
        state.editOptions = [...(q.options || [])];

        document.getElementById('edit-q-title').textContent = '编辑题目';
        document.getElementById('edit-q-type').value = q.type;
        document.getElementById('edit-q-content').value = q.content;
        document.getElementById('edit-q-answer').value = q.answer;
        document.getElementById('edit-q-explanation').value = q.explanation || '';
        renderEditOptions();
        onQuestionTypeChange();
        navigateTo('edit-question');
    }

    async function aiFormatImportText() {
        const input = document.getElementById('import-text');
        const rawText = input.value.trim();
        if (!rawText) {
            showToast('请先输入原始题目文本');
            return;
        }
        try {
            showToast('AI 正在识别并排版题目...');
            const questions = await AiService.parseQuestionsFromText(rawText);
            if (!questions.length) {
                showToast('AI 未识别到题目');
                return;
            }
            state.previewQuestions = questions;
            input.value = questions.map(formatQuestionForText).join('\n\n');
            renderPreview(questions);
        } catch (error) {
            showToast(error.message || 'AI 识别失败');
        }
    }

    async function aiFormatFileText() {
        const input = document.getElementById('file-text');
        const rawText = input.value.trim();
        if (!rawText) {
            showToast('请先上传并提取文档文本');
            return;
        }
        try {
            showToast('AI 正在识别文档中的题目...');
            const questions = await AiService.parseQuestionsFromText(rawText);
            if (!questions.length) {
                showToast('AI 未识别到题目');
                return;
            }
            state.previewQuestions = questions;
            const mergedText = questions.map(formatQuestionForText).join('\n\n');
            input.value = mergedText;
            document.getElementById('import-text').value = mergedText;
            document.getElementById('import-bank-name').value = document.getElementById('import-file-bank-name').value.trim();
            renderPreview(questions);
        } catch (error) {
            showToast(error.message || 'AI 识别失败');
        }
    }

    async function aiGenerateExplanation() {
        const settings = Storage.getSettings();
        if (!settings.aiEnabled || !settings.aiUseForExplanation) {
            showToast('请先在设置中开启 AI 解析功能');
            return;
        }

        const type = document.getElementById('edit-q-type').value;
        const content = document.getElementById('edit-q-content').value.trim();
        const answer = document.getElementById('edit-q-answer').value.trim();
        const explanationEl = document.getElementById('edit-q-explanation');
        const options = (type === 'single' || type === 'multiple')
            ? state.editOptions.filter(o => o.trim())
            : [];

        if (!content || !answer) {
            showToast('请先填写题目和答案');
            return;
        }

        try {
            showToast('AI 正在生成解析...');
            const explanation = await AiService.generateExplanation({ type, content, answer, options });
            explanationEl.value = explanation;
            showToast('AI 解析已生成');
        } catch (error) {
            showToast(error.message || 'AI 生成解析失败');
        }
    }

    async function aiGenerateQuestionExplanation(bankId, questionId) {
        const settings = Storage.getSettings();
        if (!settings.aiEnabled || !settings.aiUseForExplanation) {
            showToast('请先在设置中开启 AI 解析功能');
            return;
        }

        const q = Storage.getQuestion(bankId, questionId);
        if (!q) {
            showToast('题目不存在');
            return;
        }

        try {
            showToast('AI 正在补全本题解析...');
            const explanation = await AiService.generateExplanation(q);
            Storage.updateQuestion(bankId, questionId, { explanation });
            renderQuestionList(bankId);
            showToast('本题解析已补全');
        } catch (error) {
            showToast(error.message || 'AI 补全解析失败');
        }
    }

    async function aiBatchGenerateExplanations(targetBankId, options) {
        const bankId = targetBankId || state.currentBankId;
        const settings = Storage.getSettings();
        if (!settings.aiEnabled || !settings.aiUseForExplanation) {
            showToast('请先在设置中开启 AI 解析功能');
            return;
        }

        const bank = Storage.getBank(bankId);
        if (!bank) {
            showToast('题库不存在');
            return;
        }

        const onlyMissing = !options || options.onlyMissing !== false;
        const queue = bank.questions
            .map((q, index) => ({ q, index }))
            .filter(item => onlyMissing ? !item.q.explanation : true);

        if (!queue.length) {
            showToast(onlyMissing ? '当前题库所有题目都已有解析' : '没有可处理的题目');
            return;
        }

        if (!options || !options.silentStart) {
            showToast(`开始批量补全解析，共 ${queue.length} 题`);
        }

        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < queue.length; i++) {
            const item = queue[i];
            try {
                const explanation = await AiService.generateExplanation(item.q);
                Storage.updateQuestion(bankId, item.q.id, { explanation });
                successCount++;
            } catch (error) {
                failCount++;
                if (!settings.aiAutoFallback) {
                    throw error;
                }
            }
        }

        renderQuestionList(bankId);
        const latestBank = Storage.getBank(bankId);
        if (latestBank) {
            document.getElementById('bank-q-count').textContent = latestBank.questions.length;
        }
        showToast(`批量补全完成：成功 ${successCount} 题，失败 ${failCount} 题`);
    }

    async function aiFormatCurrentQuestion() {
        const contentEl = document.getElementById('edit-q-content');
        const rawText = contentEl.value.trim();
        if (!rawText) {
            showToast('请先粘贴原始题目内容');
            return;
        }

        try {
            showToast('AI 正在识别题目结构...');
            const questions = await AiService.parseQuestionsFromText(rawText);
            const q = questions[0];
            if (!q) {
                showToast('AI 未识别到题目');
                return;
            }
            document.getElementById('edit-q-type').value = q.type;
            document.getElementById('edit-q-content').value = q.content;
            document.getElementById('edit-q-answer').value = q.answer;
            document.getElementById('edit-q-explanation').value = q.explanation || '';
            state.editOptions = q.options || [];
            renderEditOptions();
            onQuestionTypeChange();
            showToast('AI 已完成题目识别');
        } catch (error) {
            showToast(error.message || 'AI 识别失败');
        }
    }

    function onQuestionTypeChange() {
        const type = document.getElementById('edit-q-type').value;
        const optionsArea = document.getElementById('edit-options-area');
        const answerHint = document.getElementById('answer-hint');

        if (type === 'single' || type === 'multiple') {
            optionsArea.style.display = '';
            if (state.editOptions.length === 0) {
                state.editOptions = ['', '', '', ''];
                renderEditOptions();
            }
        } else {
            optionsArea.style.display = 'none';
        }

        // 答案提示
        const hints = {
            single: '输入正确选项的字母，如：A',
            multiple: '输入所有正确选项的字母，如：ABC',
            truefalse: '输入"正确"或"错误"',
            fillblank: '输入填空答案',
            shortanswer: '输入参考答案'
        };
        answerHint.textContent = hints[type] || '';
    }

    function renderEditOptions() {
        const listEl = document.getElementById('edit-options-list');
        const labels = 'ABCDEFGHIJ';
        listEl.innerHTML = state.editOptions.map((opt, i) => `
            <div class="option-edit-row">
                <span class="option-edit-label">${labels[i]}</span>
                <input type="text" class="option-edit-input" value="${escapeAttr(opt)}" placeholder="选项内容" oninput="App.updateEditOption(${i}, this.value)">
                <button class="option-remove-btn" onclick="App.removeEditOption(${i})" aria-label="删除选项">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `).join('');
    }

    function addOption() {
        if (state.editOptions.length >= 10) {
            showToast('最多10个选项');
            return;
        }
        state.editOptions.push('');
        renderEditOptions();
    }

    function updateEditOption(index, value) {
        state.editOptions[index] = value;
    }

    function removeEditOption(index) {
        state.editOptions.splice(index, 1);
        renderEditOptions();
    }

    function saveQuestion() {
        const type = document.getElementById('edit-q-type').value;
        const content = document.getElementById('edit-q-content').value.trim();
        const answer = document.getElementById('edit-q-answer').value.trim();
        const explanation = document.getElementById('edit-q-explanation').value.trim();

        if (!content) {
            showToast('请输入题目内容');
            return;
        }
        if (!answer) {
            showToast('请输入正确答案');
            return;
        }

        const questionData = {
            type: type,
            content: content,
            answer: answer,
            explanation: explanation
        };

        if (type === 'single' || type === 'multiple') {
            questionData.options = state.editOptions.filter(o => o.trim());
            if (questionData.options.length < 2) {
                showToast('至少需要2个选项');
                return;
            }
        }

        if (state.editingQuestionId) {
            Storage.updateQuestion(state.currentBankId, state.editingQuestionId, questionData);
            showToast('题目已更新');
        } else {
            Storage.addQuestion(state.currentBankId, questionData);
            showToast('题目已添加');
        }

        // 刷新题库详情
        openBank(state.currentBankId);
    }

    function cancelEditQuestion() {
        openBank(state.currentBankId);
    }

    function deleteQuestion(bankId, questionId) {
        showConfirm('删除题目', '确定要删除这道题目吗？', function() {
            Storage.deleteQuestion(bankId, questionId);
            showToast('题目已删除');
            renderQuestionList(bankId);
            // 更新统计
            const bank = Storage.getBank(bankId);
            if (bank) {
                document.getElementById('bank-q-count').textContent = bank.questions.length;
                document.getElementById('bank-mastered').textContent = bank.questions.filter(q => q.mastered).length;
            }
        });
    }

    // ==================== 模态框 ====================

    function showModal(content) {
        document.getElementById('modal-content').innerHTML = content;
        document.getElementById('modal-overlay').style.display = 'flex';
    }

    function closeModal(event) {
        // 如果是点击overlay背景关闭，只处理点击overlay本身的情况
        if (event && event.target && event.target.id === 'modal-overlay') {
            document.getElementById('modal-overlay').style.display = 'none';
            return;
        }
        // 如果没有event参数（直接调用），直接关闭
        if (!event) {
            document.getElementById('modal-overlay').style.display = 'none';
        }
    }

    function showConfirm(title, message, onConfirm) {
        showModal(`
            <div class="modal-header">${escapeHtml(title)}</div>
            <div class="modal-body">
                <p style="font-size:15px;line-height:1.6;color:var(--text-secondary);">${escapeHtml(message)}</p>
            </div>
            <div style="display:flex;gap:10px;padding:0 20px 16px;">
                <button class="btn-secondary" style="flex:1;" onclick="App.closeModal()">取消</button>
                <button class="btn-primary" style="flex:1;background:var(--error);" id="modal-confirm-btn">确定</button>
            </div>
        `);
        document.getElementById('modal-confirm-btn').onclick = function() {
            App.closeModal();
            onConfirm();
        };
    }

    function showPrompt(title, message, defaultValue, onConfirm) {
        showModal(`
            <div class="modal-header">${escapeHtml(title)}</div>
            <div class="modal-body">
                <p style="font-size:14px;color:var(--text-secondary);margin-bottom:10px;">${escapeHtml(message)}</p>
                <input type="text" class="form-input" id="modal-prompt-input" value="${escapeAttr(defaultValue || '')}" style="width:100%;">
            </div>
            <div style="display:flex;gap:10px;padding:0 20px 16px;">
                <button class="btn-secondary" style="flex:1;" onclick="App.closeModal()">取消</button>
                <button class="btn-primary" style="flex:1;" id="modal-confirm-btn">确定</button>
            </div>
        `);
        const input = document.getElementById('modal-prompt-input');
        input.focus();
        input.select();
        document.getElementById('modal-confirm-btn').onclick = function() {
            const value = input.value;
            App.closeModal();
            onConfirm(value);
        };
        input.onkeydown = function(e) {
            if (e.key === 'Enter') {
                document.getElementById('modal-confirm-btn').click();
            }
        };
    }

    // ==================== Toast ====================

    let toastTimer = null;
    function showToast(message) {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.style.display = 'block';
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toast.style.display = 'none';
        }, 2000);
    }

    // ==================== 工具函数 ====================

    async function resolveQuestionsWithFallback(text, options) {
        const settings = Storage.getSettings();
        const parsed = Parser.parse(text);
        if (parsed.length > 0 && !settings.aiUseForImport) {
            return parsed;
        }

        if (settings.aiEnabled && settings.aiUseForImport) {
            try {
                showToast('正在使用 AI 识别题目...');
                const aiQuestions = await AiService.parseQuestionsFromText(text);
                if (aiQuestions.length > 0) {
                    return aiQuestions;
                }
            } catch (error) {
                if (settings.aiAutoFallback) {
                    const failMessage = (options && options.failPrefix ? options.failPrefix : 'AI 识别失败，已回退普通解析：') + (error.message || '未知错误');
                    if (parsed.length > 0) {
                        showToast(failMessage);
                        return parsed;
                    }
                    showToast(failMessage);
                    return null;
                }
                showToast(error.message || 'AI 识别失败');
                return null;
            }
        }

        if (parsed.length > 0) {
            return parsed;
        }

        showToast(options && options.emptyMessage ? options.emptyMessage : '未识别到题目');
        return null;
    }

    function formatQuestionForText(q, index) {
        const labels = 'ABCDEFGHIJ';
        const lines = [];
        lines.push(`${typeof index === 'number' ? index + 1 : ''}${typeof index === 'number' ? '. ' : ''}${q.content}`.trim());
        if (q.options && q.options.length) {
            q.options.forEach((opt, idx) => {
                lines.push(`${labels[idx]}. ${opt}`);
            });
        }
        if (q.answer) lines.push(`答案：${q.answer}`);
        if (q.explanation) lines.push(`解析：${q.explanation}`);
        return lines.join('\n');
    }

    function navigateTo(viewName) {
        navigate(viewName);
    }

    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const now = Date.now();
        const diff = now - timestamp;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
        const d = new Date(timestamp);
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    function downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==================== 初始化 ====================

    function init() {
        // 预加载示例数据（如果是首次使用）
        const banks = Storage.getAllBanks();
        if (banks.length === 0) {
            loadDemoData();
        }
        renderBankList();
    }

    function loadDemoData() {
        const demoText = Parser.getExampleText();
        const questions = Parser.parse(demoText);
        const bank = Storage.createBank('编程基础题库（示例）', '包含单选、多选、判断、填空、简答五种题型的示例题目');
        Storage.addQuestions(bank.id, questions);
    }

    // 公开API
    return {
        init,
        navigate,
        backToHome,
        // 首页
        filterBanks,
        openBank,
        showBankMenu,
        renameBank,
        editBankDesc,
        confirmDeleteBank,
        exportBank,
        addQuestionsToBank,
        // 导入
        showImport,
        switchImportTab,
        previewImport,
        previewFileImport,
        confirmImport,
        cancelImport,
        handleFileUpload,
        handleImageUpload,
        aiFormatImportText,
        aiFormatFileText,
        // 背题
        startStudy,
        startStudyByType,
        nextStudyCard,
        prevStudyCard,
        toggleMastered,
        toggleStudySettings,
        exitStudy,
        // 刷题
        startPractice,
        startPracticeByType,
        selectOption,
        selectTrueFalse,
        practiceSubmit,
        practiceSkip,
        practicePrev,
        practiceNext,
        practiceNextDirect,
        practiceWrongOnly,
        togglePracticeFavorite,
        addCurrentToErrorBook,
        savePracticeProgress,
        exitPractice,
        // 收藏夹
        startFavoritePractice,
        removeFavorite,
        // 错题本
        startErrorPractice,
        filterErrors,
        removeError,
        clearAllErrors,
        // 设置
        updateSettings,
        testAiConnection,
        exportData,
        importData,
        clearAllData,
        // 编辑题目
        showAddQuestion,
        showEditQuestion,
        onQuestionTypeChange,
        addOption,
        updateEditOption,
        removeEditOption,
        saveQuestion,
        aiGenerateQuestionExplanation,
        aiBatchGenerateExplanations,
        cancelEditQuestion,
        deleteQuestion,
        aiGenerateExplanation,
        aiFormatCurrentQuestion,
        // 模态框
        showModal,
        closeModal,
        // 工具
        downloadFile,
    };
})();

// 启动应用
document.addEventListener('DOMContentLoaded', function() {
    App.init();
});
