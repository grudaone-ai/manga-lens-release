"use strict";
var MangaLensPopup = (() => {
  // src/popup/popup.js
  var toggleEnabled = document.getElementById("toggleEnabled");
  var zhipuApiKeyInput = document.getElementById("zhipuApiKey");
  var zhipuVisionModelInput = document.getElementById("zhipuVisionModel");
  var btnSave = document.getElementById("btnSave");
  var btnTest = document.getElementById("btnTest");
  var btnRefresh = document.getElementById("btnRefresh");
  var btnSelect = document.getElementById("btnSelect");
  var alertContainer = document.getElementById("alertContainer");
  var processedCount = document.getElementById("processedCount");
  var cacheCount = document.getElementById("cacheCount");
  function showAlert(message, type = "success") {
    alertContainer.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
      alertContainer.innerHTML = "";
    }, 4e3);
  }
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }
  async function updateStatus() {
    try {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_STATUS" });
      if (response) {
        processedCount.textContent = response.processedCount || 0;
        cacheCount.textContent = response.cacheSize || 0;
      }
    } catch {
      processedCount.textContent = "0";
      cacheCount.textContent = "0";
    }
  }
  async function loadConfig() {
    const result = await chrome.storage.local.get([
      "zhipuApiKey",
      "zhipuVisionModel",
      "zhipuTranslationModel",
      "isEnabled"
    ]);
    zhipuApiKeyInput.value = result.zhipuApiKey || "";
    zhipuVisionModelInput.value = result.zhipuVisionModel || result.zhipuTranslationModel || "glm-4.6v";
    toggleEnabled.checked = result.isEnabled !== false;
  }
  async function notifyContentScript(config) {
    try {
      const tab = await getActiveTab();
      if (!tab?.id) return;
      await chrome.tabs.sendMessage(tab.id, {
        type: "CONFIGURE_ZHIPU_API",
        ...config
      });
    } catch {
    }
  }
  async function saveConfig() {
    const config = {
      zhipuApiKey: zhipuApiKeyInput.value.trim(),
      zhipuVisionModel: zhipuVisionModelInput.value.trim() || "glm-4.6v"
    };
    if (!config.zhipuApiKey) {
      showAlert("\u8BF7\u586B\u5199\u667A\u8C31 API Key", "error");
      return null;
    }
    await chrome.storage.local.set(config);
    await notifyContentScript(config);
    showAlert("\u667A\u8C31\u89C6\u89C9\u6A21\u578B\u914D\u7F6E\u5DF2\u4FDD\u5B58", "success");
    return config;
  }
  btnSave.addEventListener("click", saveConfig);
  btnTest.addEventListener("click", async () => {
    const config = await saveConfig();
    if (!config) return;
    showAlert("\u914D\u7F6E\u5DF2\u4FDD\u5B58\u3002\u8BF7\u5728 Pixiv \u4F5C\u54C1\u9875\u70B9\u51FB\u201C\u91CD\u65B0\u5B9A\u4F4D\u5F53\u524D Pixiv \u6F2B\u753B\u9875\u201D\u8FDB\u884C\u771F\u5B9E\u6D4B\u8BD5\u3002", "success");
  });
  btnRefresh.addEventListener("click", async () => {
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "REFRESH" });
        showAlert("\u5DF2\u91CD\u65B0\u5B9A\u4F4D\u5F53\u524D Pixiv \u6F2B\u753B\u9875", "success");
      }
    } catch {
      showAlert("\u5237\u65B0\u5931\u8D25\uFF0C\u8BF7\u5148\u5237\u65B0\u7F51\u9875\u540E\u91CD\u8BD5", "error");
    }
  });
  btnSelect.addEventListener("click", async () => {
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "SELECT_IMAGE" });
        window.close();
      }
    } catch {
      showAlert("\u5904\u7406\u5931\u8D25\uFF0C\u8BF7\u5148\u5237\u65B0\u7F51\u9875\u540E\u91CD\u8BD5", "error");
    }
  });
  toggleEnabled.addEventListener("change", async () => {
    const enabled = toggleEnabled.checked;
    await chrome.storage.local.set({ isEnabled: enabled });
    try {
      const tab = await getActiveTab();
      if (tab?.id) {
        await chrome.tabs.sendMessage(tab.id, {
          type: "TOGGLE_ENABLED",
          enabled
        });
      }
    } catch {
    }
    await updateStatus();
  });
  document.addEventListener("DOMContentLoaded", async () => {
    await loadConfig();
    await updateStatus();
    setInterval(updateStatus, 3e3);
  });
})();
