chrome.action.onClicked.addListener(async (tab) => {
  const url = typeof tab.url === 'string' && /^https?:\/\//i.test(tab.url) ? tab.url : '';
  const dashboard = chrome.runtime.getURL('dashboard.html');
  await chrome.tabs.create({url: dashboard + (url ? '?url=' + encodeURIComponent(url) : '')});
});