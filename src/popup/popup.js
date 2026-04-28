const toggleEnabled = document.getElementById('toggleEnabled');
const zhipuApiKeyInput = document.getElementById('zhipuApiKey');
const zhipuVisionModelInput = document.getElementById('zhipuVisionModel');
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
    'zhipuVisionModel',
    'zhipuTranslationModel',
    'isEnabled'
  ]);

  zhipuApiKeyInput.value = result.zhipuApiKey || '';
  zhipuVisionModelInput.value = result.zhipuVisionModel || result.zhipuTranslationModel || 'glm-4.6v';
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
    zhipuVisionModel: zhipuVisionModelInput.value.trim() || 'glm-4.6v'
  };

  if (!config.zhipuApiKey) {
    showAlert('请填写智谱 API Key', 'error');
    return null;
  }

  await chrome.storage.local.set(config);
  await notifyContentScript(config);
  showAlert('智谱视觉模型配置已保存', 'success');
  return config;
}

btnSave.addEventListener('click', saveConfig);

btnTest.addEventListener('click', async () => {
  const config = await saveConfig();
  if (!config) return;

  showAlert('配置已保存。请在 Pixiv 作品页点击“重新定位当前 Pixiv 漫画页”进行真实测试。', 'success');
});

btnRefresh.addEventListener('click', async () => {
  try {
    const tab = await getActiveTab();
    if (tab?.id) {
      await chrome.tabs.sendMessage(tab.id, { type: 'REFRESH' });
      showAlert('已重新定位当前 Pixiv 漫画页', 'success');
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
    showAlert('处理失败，请先刷新网页后重试', 'error');
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
