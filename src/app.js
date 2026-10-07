'use strict';

const apiBase = new URL('./api', document.baseURI).pathname;
const expressionInput = document.querySelector('#expression');
const resultOutput = document.querySelector('#result');
const resultLabel = document.querySelector('#result-label');
const feedback = document.querySelector('#feedback');
const form = document.querySelector('#calculator-form');
const historyList = document.querySelector('#history-list');
const historyState = document.querySelector('#history-state');
const refreshButton = document.querySelector('#refresh-history');
const previousButton = document.querySelector('#previous-page');
const nextButton = document.querySelector('#next-page');
const deleteDialog = document.querySelector('#delete-dialog');
const confirmDelete = document.querySelector('#confirm-delete');
const cancelDelete = document.querySelector('#cancel-delete');
const state = { busy: false, page: 1, pages: 1, historyRequest: 0, deleting: null };

function showFeedback(message, type = '') {
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
}

async function api(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('服务暂时不可用，请稍后重试。');
    }
    const data = await response.json();
    if (!response.ok || !data.success) {
      const error = new Error(data.message || '请求失败，请重试。');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (!error.status) {
      throw new Error(error.name === 'AbortError'
        ? '请求超时，请刷新历史确认是否已保存，再尝试计算。'
        : '暂时连接不到计算服务，请稍后重试。');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function edited() {
  resultLabel.textContent = resultOutput.textContent === '0' ? '计算结果' : '上次结果';
  showFeedback('');
}

function insertText(text) {
  if (state.busy) return;
  const start = expressionInput.selectionStart ?? expressionInput.value.length;
  const end = expressionInput.selectionEnd ?? start;
  if (expressionInput.value.length - (end - start) + text.length > 500) {
    showFeedback('表达式不能超过 500 个字符。', 'error');
    return;
  }
  expressionInput.setRangeText(text, start, end, 'end');
  expressionInput.focus();
  edited();
}

function clearInput() {
  if (state.busy) return;
  expressionInput.value = '';
  resultOutput.textContent = '0';
  resultOutput.classList.remove('long');
  resultLabel.textContent = '计算结果';
  showFeedback('');
  expressionInput.focus();
}

function backspace() {
  if (state.busy) return;
  const start = expressionInput.selectionStart ?? expressionInput.value.length;
  const end = expressionInput.selectionEnd ?? start;
  expressionInput.setRangeText('', start === end ? Math.max(0, start - 1) : start, end, 'end');
  expressionInput.focus();
  edited();
}

function setBusy(busy) {
  state.busy = busy;
  expressionInput.readOnly = busy;
  form.querySelectorAll('button').forEach((button) => { button.disabled = busy; });
  document.querySelector('#calculate-button').textContent = busy ? '…' : '=';
}

async function calculate() {
  if (state.busy) return;
  if (!expressionInput.value.trim()) {
    showFeedback('请输入算式。', 'error');
    expressionInput.focus();
    return;
  }
  setBusy(true);
  showFeedback('正在计算…');
  try {
    const data = await api('/calculate', {
      method: 'POST',
      body: JSON.stringify({ expression: expressionInput.value }),
    });
    resultOutput.textContent = data.result;
    resultOutput.classList.toggle('long', data.result.length > 14);
    resultLabel.textContent = '计算结果';
    showFeedback('');
    await loadHistory(1);
  } catch (error) {
    resultLabel.textContent = '本次未得到结果';
    resultOutput.textContent = '—';
    resultOutput.classList.remove('long');
    showFeedback(error.message, 'error');
  } finally {
    setBusy(false);
    expressionInput.focus();
  }
}

function renderHistory(data) {
  state.page = data.page;
  state.pages = data.pages;
  document.querySelector('#history-count').textContent = data.total;
  document.querySelector('#page-label').textContent = `第 ${data.page} / ${data.pages} 页`;
  historyList.replaceChildren();
  historyState.hidden = data.items.length > 0;
  historyList.hidden = data.items.length === 0;
  if (!data.items.length) {
    historyState.textContent = '暂无记录';
  }
  for (const record of data.items) {
    const row = document.createElement('li');
    row.className = 'history-row';
    row.dataset.recordId = record.id;
    const reuse = document.createElement('button');
    reuse.type = 'button';
    reuse.className = 'history-entry';
    reuse.setAttribute('aria-label', `使用算式 ${record.expression}`);
    const expression = document.createElement('span');
    expression.className = 'history-expression';
    expression.textContent = record.expression;
    const result = document.createElement('span');
    result.className = 'history-result';
    result.textContent = `= ${record.result}`;
    const time = document.createElement('time');
    time.className = 'history-time';
    time.dateTime = record.created_at;
    time.textContent = new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit',
      minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date(record.created_at));
    reuse.append(expression, result, time);
    reuse.addEventListener('click', () => {
      if (state.busy) return;
      expressionInput.value = record.expression;
      expressionInput.focus();
      expressionInput.setSelectionRange(record.expression.length, record.expression.length);
      edited();
    });
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'delete-record';
    remove.textContent = '删除';
    remove.setAttribute('aria-label', `删除记录 ${record.expression}`);
    remove.addEventListener('click', () => {
      state.deleting = record;
      document.querySelector('#delete-description').textContent = `${record.expression} = ${record.result}`;
      deleteDialog.showModal();
      cancelDelete.focus();
    });
    row.append(reuse, remove);
    historyList.append(row);
  }
}

async function loadHistory(page = state.page) {
  const requestId = ++state.historyRequest;
  refreshButton.disabled = true;
  previousButton.disabled = true;
  nextButton.disabled = true;
  try {
    const data = await api(`/history?page=${page}&page_size=5`);
    if (requestId !== state.historyRequest) return;
    renderHistory(data);
    previousButton.disabled = data.page <= 1;
    nextButton.disabled = data.page >= data.pages;
  } catch (error) {
    if (requestId !== state.historyRequest) return;
    historyList.hidden = true;
    historyState.hidden = false;
    historyState.textContent = `${error.message} 点击刷新重试。`;
  } finally {
    if (requestId === state.historyRequest) refreshButton.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  calculate();
});
expressionInput.addEventListener('input', edited);
document.querySelector('.keypad').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.insert) insertText(button.dataset.insert);
  if (button.dataset.action === 'clear') clearInput();
  if (button.dataset.action === 'backspace') backspace();
});
document.addEventListener('keydown', (event) => {
  if (deleteDialog.open || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    clearInput();
  } else if (document.activeElement !== expressionInput) {
    if (/^[0-9.+\-*/()]$/.test(event.key)) {
      event.preventDefault();
      insertText(event.key);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      backspace();
    }
  }
});
refreshButton.addEventListener('click', () => loadHistory());
previousButton.addEventListener('click', () => loadHistory(state.page - 1));
nextButton.addEventListener('click', () => loadHistory(state.page + 1));
cancelDelete.addEventListener('click', () => deleteDialog.close());
deleteDialog.addEventListener('cancel', (event) => {
  if (confirmDelete.disabled) event.preventDefault();
});
confirmDelete.addEventListener('click', async () => {
  if (!state.deleting || confirmDelete.disabled) return;
  confirmDelete.disabled = true;
  cancelDelete.disabled = true;
  try {
    await api(`/history/${state.deleting.id}`, { method: 'DELETE' });
    showFeedback('已删除。', 'success');
  } catch (error) {
    showFeedback(error.message, 'error');
  } finally {
    deleteDialog.close();
    state.deleting = null;
    confirmDelete.disabled = false;
    cancelDelete.disabled = false;
    await loadHistory();
  }
});

loadHistory(1);
