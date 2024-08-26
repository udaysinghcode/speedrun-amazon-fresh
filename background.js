// Listen for messages from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === "processItems") {
      processItems(request.items, sender.tab.id)
        .then(() => sendResponse({ status: "Processing completed" }))
        .catch((error) =>
          sendResponse({ status: "Error", error: error.message })
        );
      return true; // Indicates that the response is sent asynchronously
    } else if (request.action === "itemAdded") {
      processNextItem(sender.tab.id)
        .then(() => sendResponse({ status: "Moving to next item" }))
        .catch((error) =>
          sendResponse({ status: "Error", error: error.message })
        );
      return true;
    }
  } catch (error) {
    console.error("Error in message listener:", error);
    handleRuntimeError();
  }
});

// At the top of the file
function handleRuntimeError() {
  console.error("Runtime error occurred. Resetting extension state...");
  currentItems = [];
  currentIndex = 0;
  clearInterval(stopwatchInterval);
}

let currentItems = [];
let currentIndex = 0;
let startTime;
let stopwatchInterval;

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

  // Add instructions and button underneath search results
  await chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: addInstructionsUnderResults,
    args: [
      productName,
      quantity,
      note,
      currentIndex,
      currentItems.length,
      currentItems,
    ],
  });
}

function addInstructionsUnderResults(
  productName,
  quantity,
  note,
  currentIndex,
  totalItems,
  allItems
) {
  // Remove any existing instructions
  const existingInstructions = document.getElementById(
    "grocery-list-instructions"
  );
  if (existingInstructions) {
    existingInstructions.remove();
  }

  const instructionsDiv = document.createElement("div");
  instructionsDiv.id = "grocery-list-instructions";
  instructionsDiv.style.padding = "20px";
  instructionsDiv.style.backgroundColor = "#f8f8f8";
  instructionsDiv.style.border = "1px solid #ddd";
  instructionsDiv.style.marginBottom = "20px";

  let noteHtml = "";
  if (note) {
    noteHtml = `<p style="font-style: italic; margin-bottom: 10px;">Note from Q: ${note}</p>`;
  }

  let nextItem = "";
  let onDeckItem = "";
  let footerHtml = "";

  if (currentIndex + 1 < totalItems) {
    nextItem = allItems[currentIndex + 1];
    if (currentIndex + 2 < totalItems) {
      onDeckItem = allItems[currentIndex + 2];
    }

    footerHtml = `
      <div style="background-color: #f0f0f0; padding: 10px; margin-top: 20px; border-radius: 5px; text-align: left;">
        <p style="margin: 5px 0;"><strong>🔜 Next:</strong> ${
          nextItem || ""
        }</p>
        ${
          onDeckItem
            ? `<p style="margin: 5px 0;"><strong>🎯 On Deck:</strong> ${onDeckItem}</p>`
            : ""
        }
      </div>
    `;
  } else {
    footerHtml = `
      <div style="background-color: #f0f0f0; padding: 10px; margin-top: 20px; border-radius: 5px; text-align: center;">
        <p style="margin: 5px 0; font-size: 18px;"><strong>🚀 Final Item!</strong></p>
      </div>
    `;
  }

  instructionsDiv.innerHTML = `
    <h3>Grocery Speed Run</h3>
    <p id="stopwatch">Time: 00:00</p>
    <h4>Please add ${productName} to your cart (Item ${
    currentIndex + 1
  } of ${totalItems})</h4>
    ${noteHtml}
    <p>Quantity: ${quantity}</p>
    <button id="itemAddedBtn" style="padding: 10px 20px; background-color: #4CAF50; color: white; border: none; cursor: pointer;">I've added the item</button>
    <button id="skipItemBtn" style="padding: 10px 20px; background-color: #f44336; color: white; border: none; cursor: pointer; margin-left: 10px;">Skip this item</button>
    ${footerHtml}
  `;

  // Find the main content area
  const mainContent =
    document.getElementById("search") || document.getElementById("a-page");
  if (mainContent) {
    // Insert the instructions at the beginning of the main content
    mainContent.insertAdjacentElement("afterbegin", instructionsDiv);

    document.getElementById("itemAddedBtn").addEventListener("click", () => {
      instructionsDiv.remove();
      chrome.runtime.sendMessage({ action: "itemAdded" });
    });

    document.getElementById("skipItemBtn").addEventListener("click", () => {
      instructionsDiv.remove();
      chrome.runtime.sendMessage({ action: "itemAdded" });
    });
  } else {
    console.error("Could not find main content area");
  }

  // Start the stopwatch
  updateStopwatch();
}

function updateStopwatch() {
  const stopwatchElement = document.getElementById("stopwatch");
  if (stopwatchElement) {
    const elapsedTime = Date.now() - startTime;
    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    const milliseconds = elapsedTime % 1000;
    const timeString = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
    stopwatchElement.textContent = timeString;
    setTimeout(updateStopwatch, 1000);
  }
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
