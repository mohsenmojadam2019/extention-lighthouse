chrome.action.onClicked.addListener(async tab => {
  const url = tab?.url && /^https?:\/\//i.test(tab.url) ? tab.url : '';
  await chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard.html') + (url ? '?url=' + encodeURIComponent(url) : '')
  });
});
