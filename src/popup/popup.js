const toggleEnabled = document.getElementById('toggleEnabled');
const zhipuApiKeyInput = document.getElementById('zhipuApiKey');
const zhipuTranslationModelInput = document.getElementById('zhipuTranslationModel');
const zhipuOcrModelInput = document.getElementById('zhipuOcrModel');
const btnSave = document.getElementById('btnSave');
const btnTest = document.getElementById('btnTest');
const btnRefresh = document.getElementById('btnRefresh');
const btnSelect = document.getElementById('btnSelect');
const alertContainer = document.getElementById('alertContainer');
const processedCount = document.getElementById('processedCount');
const cacheCount = document.getElementById('cacheCount');

function showAlert(message, type = 'success') {
  alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
  setTimeout(() => {
    alertContainer.innerHTML = '';
  }, 4000);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function updateStatus() {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_STATUS' });
    if (response) {
      processedCount.textContent = response.processedCount || 0;
      cacheCount.textContent = response.cacheSize || 0;
    }
  } catch {
    processedCount.textContent = '0';
    cacheCount.textContent = '0';
  }
}

async function loadConfig() {
  const result = await chrome.storage.local.get([
    'zhipuApiKey',
    'zhipuTranslationModel',
    'zhipuOcrModel',
    'isEnabled'
  ]);

  zhipuApiKeyInput.value = result.zhipuApiKey || '';
  zhipuTranslationModelInput.value = result.zhipuTranslationModel || 'glm-4.7';
  zhipuOcrModelInput.value = result.zhipuOcrModel || 'glm-ocr';
  toggleEnabled.checked = result.isEnabled !== false;
}

async function notifyContentScript(config) {
  try {
    const tab = await getActiveTab();
    if (!tab?.id) return;

    await chrome.tabs.sendMessage(tab.id, {
      type: 'CONFIGURE_ZHIPU_API',
      ...config
    });
  } catch {
    // The current tab may not have the content script yet.
  }
}

async function saveConfig() {
  const config = {
    zhipuApiKey: zhipuApiKeyInput.value.trim(),
    zhipuTranslationModel: zhipuTranslationModelInput.value.trim() || 'glm-4.7',
    zhipuOcrModel: zhipuOcrModelInput.value.trim() || 'glm-ocr'
  };

  if (!config.zhipuApiKey) {
    showAlert('请填写智谱 API Key', 'error');
    return null;
  }

  await chrome.storage.local.set(config);
  await notifyContentScript(config);
  showAlert('智谱配置已保存', 'success');
  return config;
}

btnSave.addEventListener('click', saveConfig);

btnTest.addEventListener('click', async () => {
  const config = await saveConfig();
  if (!config) return;

  showAlert('正在测试智谱 OCR...', 'warning');

  try {
    const response = await chrome.runtime.sendMessage({
      target: 'background',
      type: 'TEST_ZHIPU_OCR',
      apiKey: config.zhipuApiKey,
      model: config.zhipuOcrModel
    });

    if (response?.success) {
      showAlert(response.message || '智谱连接成功', 'success');
    } else {
      showAlert(response?.message || '智谱连接失败', 'error');
    }
  } catch (error) {
    showAlert(error.message || '智谱连接测试失败', 'error');
  }
});

btnRefresh.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'REFRESH' });
      showAlert('已刷新，正在重新翻译', 'success');
    }
  } catch {
    showAlert('刷新失败，请先刷新网页后重试', 'error');
  }
});

btnSelect.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'SELECT_IMAGE' });
      window.close();
    }
  } catch {
    showAlert('选择失败，请先刷新网页后重试', 'error');
  }
});

toggleEnabled.addEventListener('change', async () => {
  const enabled = toggleEnabled.checked;
  await chrome.storage.local.set({ isEnabled: enabled });

  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'TOGGLE_ENABLED',
        enabled
      });
    }
  } catch {
    // The current tab may not have the content script yet.
  }

  await updateStatus();
});

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig();
  await updateStatus();
  setInterval(updateStatus, 3000);
});
