// FileParser - 多格式题库文档文本提取器
// 支持: txt / docx / pdf / xlsx / xls / csv
// doc 由于浏览器端无法稳定解析二进制旧版 Word，提示用户先另存为 docx

const FileParser = (function() {
    const SUPPORTED_EXTENSIONS = ['txt', 'text', 'docx', 'doc', 'pdf', 'xlsx', 'xls', 'csv'];

    function getExtension(fileName) {
        if (!fileName || fileName.indexOf('.') === -1) return '';
        return fileName.split('.').pop().toLowerCase();
    }

    function isSupported(file) {
        return SUPPORTED_EXTENSIONS.includes(getExtension(file.name || ''));
    }

    function getSupportedAccept() {
        return '.txt,.text,.docx,.doc,.pdf,.xlsx,.xls,.csv';
    }

    function getDisplayName(file) {
        return file && file.name ? file.name.replace(/\.[^.]+$/, '') : '未命名题库';
    }

    async function parseFile(file) {
        if (!file) {
            throw new Error('未选择文件');
        }

        const ext = getExtension(file.name);
        if (!SUPPORTED_EXTENSIONS.includes(ext)) {
            throw new Error('暂不支持该文件格式');
        }

        switch (ext) {
            case 'txt':
            case 'text':
            case 'csv':
                return readTextFile(file);
            case 'docx':
                return readDocxFile(file);
            case 'doc':
                throw new Error('暂不支持直接解析 .doc，请先将文件另存为 .docx 后再导入');
            case 'pdf':
                return readPdfFile(file);
            case 'xlsx':
            case 'xls':
                return readExcelFile(file);
            default:
                throw new Error('暂不支持该文件格式');
        }
    }

    function readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(normalizeText(e.target.result || ''));
            reader.onerror = () => reject(new Error('读取文本文件失败'));
            reader.readAsText(file, 'UTF-8');
        });
    }

    function readArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = () => reject(new Error('读取文件失败'));
            reader.readAsArrayBuffer(file);
        });
    }

    async function readDocxFile(file) {
        if (typeof mammoth === 'undefined') {
            throw new Error('DOCX 解析库未加载');
        }
        const arrayBuffer = await readArrayBuffer(file);
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = normalizeText(result.value || '');
        if (!text.trim()) {
            throw new Error('DOCX 文件中未提取到文本');
        }
        return text;
    }

    async function readPdfFile(file) {
        if (typeof pdfjsLib === 'undefined') {
            throw new Error('PDF 解析库未加载');
        }

        if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/libs/pdf.worker.min.js';
        }

        const arrayBuffer = await readArrayBuffer(file);
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const content = await page.getTextContent();
            const lines = [];
            let currentLine = '';
            let lastY = null;

            content.items.forEach(item => {
                const str = item.str || '';
                const y = item.transform ? item.transform[5] : null;
                if (lastY !== null && y !== null && Math.abs(y - lastY) > 3) {
                    if (currentLine.trim()) lines.push(currentLine.trim());
                    currentLine = str;
                } else {
                    currentLine += (currentLine ? ' ' : '') + str;
                }
                lastY = y;
            });

            if (currentLine.trim()) lines.push(currentLine.trim());
            pages.push(lines.join('\n'));
        }

        const text = normalizeText(pages.join('\n\n'));
        if (!text.trim()) {
            throw new Error('PDF 文件中未提取到文本');
        }
        return text;
    }

    async function readExcelFile(file) {
        if (typeof XLSX === 'undefined') {
            throw new Error('Excel 解析库未加载');
        }

        const arrayBuffer = await readArrayBuffer(file);
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const parts = [];

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
            if (!rows.length) return;

            parts.push(`### 工作表: ${sheetName}`);
            rows.forEach(row => {
                const line = row
                    .map(cell => String(cell).trim())
                    .filter(Boolean)
                    .join(' ');
                if (line) parts.push(line);
            });
            parts.push('');
        });

        const text = normalizeText(parts.join('\n'));
        if (!text.trim()) {
            throw new Error('Excel 文件中未提取到文本');
        }
        return text;
    }

    function normalizeText(text) {
        return String(text || '')
            .replace(/\u00A0/g, ' ')
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    return {
        parseFile,
        isSupported,
        getSupportedAccept,
        getDisplayName,
        getExtension
    };
})();
