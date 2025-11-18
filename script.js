// DOM 요소들 --------------------------------------------------------------
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const memoListEl = document.getElementById('memo-list');
const newMemoBtn = document.getElementById('new-memo-btn');
const saveBtn = document.getElementById('save-btn');

const titleInput = document.getElementById('memo-title');
const dateInput = document.getElementById('memo-date');
const tagsInput = document.getElementById('memo-tags');
const editor = document.getElementById('memo-text');

const fontSizeSelect = document.getElementById('font-size');
const boldBtn = document.getElementById('bold-btn');

const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview');

const searchInput = document.getElementById('search-input');
const tagFilterSelect = document.getElementById('tag-filter');

// 상태 ---------------------------------------------------------------------
let memos = [];
let currentEditId = null;

const STORAGE_KEY = 'note_editor_with_images_v1';

// 오늘 날짜 문자열
function getTodayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
}

// 태그 파싱/조합 -----------------------------------------------------------
function parseTags(tagString) {
    if (!tagString) return [];
    return tagString
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
}

function tagsToString(tags) {
    return (tags || []).join(', ');
}

// localStorage -------------------------------------------------------------
function loadMemos() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        memos = [];
        return;
    }
    try {
        const data = JSON.parse(raw);
        memos = Array.isArray(data) ? data : [];
    } catch (e) {
        memos = [];
    }

    // 방어 코드
    memos.forEach(m => {
        if (!Array.isArray(m.tags)) m.tags = [];
        if (!m.fontSize) m.fontSize = '16px';
        if (typeof m.isBold !== 'boolean') m.isBold = false;
        if (!m.contentHTML) m.contentHTML = '';
    });
}

function saveMemos() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memos));
}

// 에디터/폼 초기화 ---------------------------------------------------------
function resetEditor() {
    currentEditId = null;
    titleInput.value = '';
    tagsInput.value = '';
    dateInput.value = getTodayStr();
    editor.innerHTML = '';
    editor.style.fontSize = '16px';
    editor.style.fontWeight = 'normal';
    fontSizeSelect.value = '16px';
    boldBtn.classList.remove('active');
    syncImagePreviewFromEditor();
}

// 썸네일 미리보기: editor 안의 img 기준 -----------------------------------
function syncImagePreviewFromEditor() {
    imagePreview.innerHTML = '';
    const imgs = editor.querySelectorAll('img');

    imgs.forEach(img => {
        const thumb = document.createElement('div');
        thumb.className = 'image-thumb';

        const thumbImg = document.createElement('img');
        thumbImg.src = img.src;

        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.title = '이미지 삭제';

        delBtn.addEventListener('click', () => {
            img.remove();               // 에디터 안에서 삭제
            syncImagePreviewFromEditor();
        });

        thumb.appendChild(thumbImg);
        thumb.appendChild(delBtn);
        imagePreview.appendChild(thumb);
    });
}

// 메모 리스트 렌더링 -------------------------------------------------------
function countImagesFromHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html || '';
    return temp.querySelectorAll('img').length;
}

function getPlainTextFromHTML(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html || '';
    return temp.textContent || '';
}

function renderMemoList() {
    memoListEl.innerHTML = '';

    const searchTerm = searchInput.value.trim().toLowerCase();
    const selectedTag = tagFilterSelect.value;

    let list = memos.slice();

    // 검색 필터 (제목 + 내용 텍스트 + 태그)
    if (searchTerm) {
        list = list.filter(m => {
            const plain = getPlainTextFromHTML(m.contentHTML);
            const haystack = (m.title + ' ' + plain + ' ' + tagsToString(m.tags)).toLowerCase();
            return haystack.includes(searchTerm);
        });
    }

    // 태그 필터
    if (selectedTag) {
        list = list.filter(m => m.tags.includes(selectedTag));
    }

    // 최신순 정렬
    list.sort((a, b) => b.id - a.id);

    if (list.length === 0) {
        const p = document.createElement('p');
        p.className = 'placeholder-text';
        p.textContent = '메모가 없습니다.';
        memoListEl.appendChild(p);
        return;
    }

    list.forEach(memo => {
        const item = document.createElement('div');
        item.className = 'memo-item';
        if (memo.id === currentEditId) {
            item.classList.add('active');
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'memo-title';
        titleEl.textContent = memo.title || '(제목 없음)';

        const dateEl = document.createElement('div');
        dateEl.className = 'memo-date';
        dateEl.textContent = memo.date || '';

        const tagsWrap = document.createElement('div');
        tagsWrap.className = 'memo-tags';
        (memo.tags || []).forEach(tag => {
            const tagEl = document.createElement('span');
            tagEl.className = 'tag-badge';
            tagEl.textContent = tag;
            tagsWrap.appendChild(tagEl);
        });

        const imgCount = countImagesFromHTML(memo.contentHTML);
        let imgInfo = null;
        if (imgCount > 0) {
            imgInfo = document.createElement('div');
            imgInfo.className = 'memo-images-info';
            imgInfo.textContent = `이미지 ${imgCount}개`;
        }

        const actions = document.createElement('div');
        actions.className = 'memo-item-actions';

        const openBtn = document.createElement('button');
        openBtn.textContent = '열기';
        openBtn.addEventListener('click', e => {
            e.stopPropagation();
            openMemo(memo.id);
        });

        const delBtn = document.createElement('button');
        delBtn.textContent = '삭제';
        delBtn.addEventListener('click', e => {
            e.stopPropagation();
            deleteMemo(memo.id);
        });

        actions.appendChild(openBtn);
        actions.appendChild(delBtn);

        item.appendChild(titleEl);
        item.appendChild(dateEl);
        if (memo.tags && memo.tags.length > 0) {
            item.appendChild(tagsWrap);
        }
        if (imgInfo) {
            item.appendChild(imgInfo);
        }
        item.appendChild(actions);

        item.addEventListener('click', () => openMemo(memo.id));

        memoListEl.appendChild(item);
    });
}

// 태그 필터 옵션 렌더링 ----------------------------------------------------
function renderTagFilterOptions() {
    const prev = tagFilterSelect.value;

    tagFilterSelect.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = '';
    allOpt.textContent = '전체';
    tagFilterSelect.appendChild(allOpt);

    const set = new Set();
    memos.forEach(m => (m.tags || []).forEach(t => set.add(t)));

    [...set].sort().forEach(tag => {
        const opt = document.createElement('option');
        opt.value = tag;
        opt.textContent = tag;
        tagFilterSelect.appendChild(opt);
    });

    if (prev === '' || set.has(prev)) {
        tagFilterSelect.value = prev;
    }
}

// 메모 열기 ---------------------------------------------------------------
function openMemo(id) {
    const memo = memos.find(m => m.id === id);
    if (!memo) return;

    currentEditId = id;
    titleInput.value = memo.title || '';
    tagsInput.value = tagsToString(memo.tags);
    dateInput.value = memo.date || getTodayStr();
    editor.innerHTML = memo.contentHTML || '';
    editor.style.fontSize = memo.fontSize || '16px';
    editor.style.fontWeight = memo.isBold ? 'bold' : 'normal';
    fontSizeSelect.value = memo.fontSize || '16px';
    if (memo.isBold) boldBtn.classList.add('active'); else boldBtn.classList.remove('active');

    syncImagePreviewFromEditor();
    renderMemoList();
}

// 메모 삭제 ---------------------------------------------------------------
function deleteMemo(id) {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;
    memos = memos.filter(m => m.id !== id);
    if (currentEditId === id) {
        resetEditor();
    }
    saveMemos();
    renderTagFilterOptions();
    renderMemoList();
}

// 이미지 업로드 처리 -------------------------------------------------------
function insertImageAtEnd(dataUrl) {
    // 단순히 끝에 붙이기
    editor.innerHTML += `<img src="${dataUrl}" alt="image"><br>`;
}

imageInput.addEventListener('change', e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = ev => {
            const dataUrl = ev.target.result;
            insertImageAtEnd(dataUrl);
            syncImagePreviewFromEditor();
        };
        reader.readAsDataURL(file);
    });

    // 같은 파일 다시 선택할 수 있도록 초기화
    imageInput.value = '';
});

// 저장 버튼 ---------------------------------------------------------------
saveBtn.addEventListener('click', () => {
    const title = titleInput.value.trim();
    const contentHTML = editor.innerHTML;
    const tags = parseTags(tagsInput.value);
    const date = dateInput.value || getTodayStr();
    const fontSize = fontSizeSelect.value;
    const isBold = boldBtn.classList.contains('active');

    if (!title && !getPlainTextFromHTML(contentHTML).trim()) {
        alert('제목 또는 내용을 입력하세요.');
        return;
    }

    if (currentEditId) {
        const idx = memos.findIndex(m => m.id === currentEditId);
        if (idx !== -1) {
            memos[idx] = {
                ...memos[idx],
                title,
                contentHTML,
                tags,
                date,
                fontSize,
                isBold
            };
        }
    } else {
        const id = Date.now(); // 한 번만 생성해서 사용
        const newMemo = {
            id,
            title,
            contentHTML,
            tags,
            date,
            fontSize,
            isBold
        };
        memos.push(newMemo);
        currentEditId = id;
    }

    saveMemos();
    renderTagFilterOptions();
    renderMemoList();
    alert('저장되었습니다.');
});

// 새 메모 ---------------------------------------------------------------
newMemoBtn.addEventListener('click', () => {
    resetEditor();
    renderMemoList();
});

// 글자 크기 / Bold --------------------------------------------------------
fontSizeSelect.addEventListener('change', () => {
    editor.style.fontSize = fontSizeSelect.value;
});

boldBtn.addEventListener('click', () => {
    const active = boldBtn.classList.toggle('active');
    editor.style.fontWeight = active ? 'bold' : 'normal';
});

// 검색 / 태그 필터 --------------------------------------------------------
searchInput.addEventListener('input', () => {
    renderMemoList();
});

tagFilterSelect.addEventListener('change', () => {
    renderMemoList();
});

// 테마 토글 ---------------------------------------------------------------
themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    const isLight = document.body.classList.contains('light-theme');
    themeToggleBtn.textContent = isLight ? '🌙' : '☀️';
});

// 초기화 -------------------------------------------------------------------
function init() {
    dateInput.value = getTodayStr();
    loadMemos();
    renderTagFilterOptions();
    renderMemoList();
    resetEditor();
}

init();
