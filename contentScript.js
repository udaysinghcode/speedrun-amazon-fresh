// Listen for messages from the page
window.addEventListener(
  "message",
  function (event) {
    // We only accept messages from ourselves
    if (event.source != window) return;

    if (event.data.type && event.data.type == "FROM_PAGE") {
      chrome.runtime.sendMessage(event.data);
    }
  },
  false
);

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  window.postMessage({ type: "FROM_EXTENSION", ...message }, "*");
});
