let isSpeedRunning = false;
let currentState = null;
let currentItems = [];
let currentIndex = 0;
let startTime;
let stopwatchInterval;

// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === "processItems") {
      isSpeedRunning = true;
      processItems(request.items, sender.tab.id)
        .then(() => sendResponse({ status: "Processing completed" }))
        .catch((error) =>
          sendResponse({ status: "Error", error: error.message })
        );
      return true; // Indicates that the response is sent asynchronously
    } else if (request.action === "itemAdded") {
      const itemStatus = request.status;
      updateItemStatus(sender.tab.id, currentIndex, itemStatus);
      processNextItem(sender.tab.id)
        .then(() => sendResponse({ status: "Moving to next item" }))
        .catch((error) =>
          sendResponse({ status: "Error", error: error.message })
        );
      return true;
    } else if (request.action === "checkSpeedRunStatus") {
      sendResponse({ isRunning: isSpeedRunning, currentState: currentState });
      return true;
    }
  } catch (error) {
    console.error("Error in message listener:", error);
    handleRuntimeError();
  }
});

function updateItemStatus(tabId, index, status) {
  chrome.tabs.sendMessage(tabId, {
    action: "updateItemStatus",
    index: index,
    status: status,
  });
}

async function searchItem(item, tabId) {
  const [productName, quantity, note] = parseItem(item);
  console.log(
    `Searching for: ${productName}, Quantity: ${quantity}, Note: ${note}`
  );

  // Search for the item with filters
  const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(
    productName
  )}&i=fresh&rh=n%3A16310101%2Cp_n_fresh_inventory%3A23854357011%2Cp_n_feature_nine_browse-bin%3A21213697011`;
  await chrome.tabs.update(tabId, { url: searchUrl });

  // Wait for the page to load
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Update the Speedrun UI
  updateSpeedrunUI(tabId);

  // Wait for the page to load
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Update the UI again after a short delay
  updateSpeedrunUI(tabId);
}

function updateSpeedrunUI(tabId) {
  const nextItems = currentItems.slice(currentIndex + 1, currentIndex + 4);
  currentState = {
    productName: currentItems[currentIndex],
    quantity: 1, // You may need to adjust this if you're tracking quantities
    note: "", // Add note handling if needed
    currentIndex,
    totalItems: currentItems.length,
    nextItems,
    allItems: currentItems,
  };
  chrome.tabs.sendMessage(tabId, {
    action: "updateSpeedrunUI",
    data: currentState,
  });
}

async function showCompletionPopup(tabId) {
  // Clear the stopwatch interval
  clearInterval(stopwatchInterval);

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const minutes = Math.floor(totalTime / 60000);
  const seconds = Math.floor((totalTime % 60000) / 1000);
  const milliseconds = totalTime % 1000;
  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;

  await chrome.tabs.sendMessage(tabId, {
    action: "showCompletionPopup",
    time: timeString,
  });

  isSpeedRunning = false;
  currentState = null;
}

function parseItem(item) {
  const match = item.match(/(.+?)(?:\s*\(([^)]+)\))?(?:\s*x\s*(\d+))?$/);
  const productName = match[1].trim();
  const note = match[2] ? match[2].trim() : null;
  const quantity = match[3] ? parseInt(match[3]) : 1;
  return [productName, quantity, note];
}

function updateStopwatch(tabId) {
  const elapsedTime = Date.now() - startTime;
  const minutes = Math.floor(elapsedTime / 60000);
  const seconds = Math.floor((elapsedTime % 60000) / 1000);
  const milliseconds = elapsedTime % 1000;
  const timeString = `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;

  chrome.tabs.sendMessage(tabId, {
    action: "updateStopwatch",
    time: timeString,
  });
}

// At the top of the file
function handleRuntimeError() {
  console.error("Runtime error occurred. Resetting extension state...");
  currentItems = [];
  currentIndex = 0;
  clearInterval(stopwatchInterval);
}

async function processItems(items, tabId) {
  currentItems = items;
  currentIndex = 0;
  startTime = Date.now();
  console.log(`Starting to process ${items.length} items`);

  // Start the stopwatch update interval
  stopwatchInterval = setInterval(() => updateStopwatch(tabId), 10);

  await processNextItem(tabId);
}

async function processNextItem(tabId) {
  if (currentIndex < currentItems.length) {
    console.log(
      `Processing item ${currentIndex + 1} of ${currentItems.length}`
    );
    try {
      await searchItem(currentItems[currentIndex], tabId);
      currentIndex++;
    } catch (error) {
      console.error(`Error processing item ${currentIndex + 1}:`, error);
      // Move to the next item even if there's an error
      currentIndex++;
      await processNextItem(tabId);
    }
  } else {
    console.log("All items processed");
    await showCompletionPopup(tabId);
  }
}
