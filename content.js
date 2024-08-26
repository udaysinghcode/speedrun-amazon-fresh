// Process the grocery list
function processGroceryList() {
  const groceryList = document.getElementById("grocery-list").value;
  const groceryArray = groceryList
    .split("\n")
    .filter((item) => item.trim() !== "");

  console.log("Grocery Array:", groceryArray);
  console.log("Array size:", groceryArray.length);

  // Hide input section and show run section
  document.getElementById("input-section").classList.add("hidden");
  document.getElementById("run-section").classList.remove("hidden");

  // Send a message to the background script
  chrome.runtime.sendMessage(
    {
      action: "processItems",
      items: groceryArray,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error sending message:", chrome.runtime.lastError);
        handleExtensionReload();
      } else {
        console.log("Message sent successfully:", response);
      }
    }
  );
}

function handleExtensionReload() {
  console.log("Extension context invalidated. Attempting to recover...");
  // Remove existing elements
  const existingPopup = document.getElementById("shopping-complete-popup");
  if (existingPopup) {
    existingPopup.remove();
  }

  // Reinitialize the extension
  initializeExtension();
}

// Add popup to the page
function addPopup() {
  const popup = document.createElement("div");
  popup.id = "shopping-complete-popup";
  popup.innerHTML = `
    <h2>Grocery Speed Run Complete!</h2>
    <p>Your shopping list has been added to Amazon Fresh</p>
    <p id="final-time"></p>
  `;
  document.body.appendChild(popup);
}

// Initialize with MutationObserver
function initializeExtension() {
  addTailwindCSS();
  addSpeedrunUI();
  addPopup();

  // Check if a speed run is in progress
  checkSpeedRunStatus();
}

// Add this new function
function checkSpeedRunStatus() {
  chrome.runtime.sendMessage({ action: "checkSpeedRunStatus" }, (response) => {
    if (response && response.isRunning) {
      showRunSection(response.currentState);
    } else {
      showInputSection();
    }
  });
}

// Add this new function to show the run section and update UI
function showRunSection(data) {
  const inputSection = document.getElementById("input-section");
  const runSection = document.getElementById("run-section");

  if (inputSection && runSection) {
    inputSection.classList.add("hidden");
    runSection.classList.remove("hidden");
    updateSpeedrunUI(data);
  } else {
    console.error("UI elements not found. Reinitializing...");
    addSpeedrunUI();
    setTimeout(() => showRunSection(data), 100); // Retry after a short delay
  }
}

function showInputSection() {
  const inputSection = document.getElementById("input-section");
  const runSection = document.getElementById("run-section");

  if (inputSection && runSection) {
    inputSection.classList.remove("hidden");
    runSection.classList.add("hidden");
  } else {
    console.error("UI elements not found. Reinitializing...");
    addSpeedrunUI();
  }
}

// Modify the message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === "showCompletionPopup") {
      const uiContainer = document.getElementById("speedrun-ui");
      if (uiContainer) {
        uiContainer.innerHTML = `
          <div class="text-center">
            <h2 class="text-2xl font-bold mb-4">Speed Run Complete!</h2>
            <p class="text-4xl font-mono mb-4">${message.time}</p>
            <p>Your grocery list has been added to Amazon Fresh</p>
          </div>
        `;
        startConfetti();
        setTimeout(() => {
          uiContainer.style.transition = "opacity 1s";
          uiContainer.style.opacity = "0";
          setTimeout(() => {
            uiContainer.remove();
            stopConfetti();
          }, 1000);
        }, 5000);
      }
    } else if (message.action === "updateStopwatch") {
      const stopwatchElement = document.getElementById("stopwatch");
      if (stopwatchElement) {
        stopwatchElement.textContent = message.time;
      } else {
        console.error("Stopwatch element not found. Reinitializing UI...");
        initializeExtension();
      }
    } else if (message.action === "updateSpeedrunUI") {
      showRunSection(message.data);
    } else if (message.action === "updateItemStatus") {
      updateItemStatus(message.index, message.status);
    }
    sendResponse({ received: true });
  } catch (error) {
    console.error("Error in message listener:", error);
    handleExtensionReload();
    sendResponse({ error: error.message });
  }
  return true;
});

// Add these functions to control the confetti animation
function startConfetti() {
  const canvas = document.createElement("canvas");
  canvas.id = "confetti-canvas";
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const numberOfPieces = 200;
  const colors = ["#f00", "#0f0", "#00f", "#ff0", "#0ff", "#f0f"];

  for (let i = 0; i < numberOfPieces; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 5 + 2,
      d: Math.random() * 5 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.floor(Math.random() * 10) - 10,
      tiltAngleIncrement: Math.random() * 0.07 + 0.05,
      tiltAngle: 0,
    });
  }

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach((p, index) => {
      ctx.beginPath();
      ctx.lineWidth = p.d;
      ctx.strokeStyle = p.color;
      ctx.moveTo(p.x + p.tilt + p.r, p.y);
      ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
      ctx.stroke();

      p.tiltAngle += p.tiltAngleIncrement;
      p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2;
      p.x += Math.sin(p.tiltAngle) * 2;

      if (p.x > canvas.width + 5 || p.x < -5 || p.y > canvas.height) {
        if (index % 5 > 0 || index % 2 == 0) {
          pieces[index] = {
            x: Math.random() * canvas.width,
            y: -10,
            r: p.r,
            d: p.d,
            color: p.color,
            tilt: Math.floor(Math.random() * 10) - 10,
            tiltAngleIncrement: p.tiltAngleIncrement,
            tiltAngle: p.tiltAngle,
          };
        } else {
          if (Math.sin(p.tiltAngle) > 0) {
            pieces[index] = {
              x: -5,
              y: Math.random() * canvas.height,
              r: p.r,
              d: p.d,
              color: p.color,
              tilt: Math.floor(Math.random() * 10) - 10,
              tiltAngleIncrement: p.tiltAngleIncrement,
              tiltAngle: p.tiltAngle,
            };
          } else {
            pieces[index] = {
              x: canvas.width + 5,
              y: Math.random() * canvas.height,
              r: p.r,
              d: p.d,
              color: p.color,
              tilt: Math.floor(Math.random() * 10) - 10,
              tiltAngleIncrement: p.tiltAngleIncrement,
              tiltAngle: p.tiltAngle,
            };
          }
        }
      }
    });
    window.requestAnimationFrame(animate);
  }

  animate();
}

function stopConfetti() {
  const confettiCanvas = document.getElementById("confetti-canvas");
  if (confettiCanvas) {
    confettiCanvas.remove();
  }
}

function addTailwindCSS() {
  const link = document.createElement("link");
  link.href =
    "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css";
  link.rel = "stylesheet";
  document.head.appendChild(link);
}

function addSpeedrunUI() {
  // Remove existing UI if it exists
  const existingUI = document.getElementById("speedrun-ui");
  if (existingUI) {
    existingUI.remove();
  }

  // Create new UI
  const uiContainer = document.createElement("div");
  uiContainer.id = "speedrun-ui";
  uiContainer.className =
    "fixed bottom-4 right-4 w-72 bg-black bg-opacity-80 text-neon-blue p-4 rounded-lg shadow-lg overflow-y-auto max-h-[80vh] border border-neon-blue";
  uiContainer.style.zIndex = "9999999";
  uiContainer.innerHTML = `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');
      #speedrun-ui {
        font-family: 'Orbitron', sans-serif;
      }
      .text-neon-blue {
        color: #00ffff;
        text-shadow: 0 0 5px #00ffff, 0 0 10px #00ffff;
      }
      .bg-neon-purple {
        background-color: #8a2be2;
      }
      .border-neon-blue {
        border-color: #00ffff;
      }
      .cyberpunk-button-green {
        background: linear-gradient(45deg, #00ff00, #00ffff);
        border: none;
        color: black;
        font-weight: bold;
        text-transform: uppercase;
        transition: all 0.3s ease;
      }
      .cyberpunk-button-red {
        background: linear-gradient(45deg, #ff0000, #ff00ff);
        border: none;
        color: black;
        font-weight: bold;
        text-transform: uppercase;
        transition: all 0.3s ease;
      }
      .cyberpunk-button-green:hover, .cyberpunk-button-red:hover {
        transform: translateY(-2px);
        box-shadow: 0 0 10px #00ffff, 0 0 20px #ff00ff;
      }
    </style>
    <div class="text-center mb-4">
      <h2 class="text-2xl font-bold text-neon-blue">Grocery Speed Run Any%</h2>
    </div>
    <div id="stopwatch" class="text-4xl font-mono text-center mb-4 text-neon-blue">00:00.000</div>
    <div id="input-section">
      <textarea id="grocery-list" class="w-full h-32 mb-4 bg-gray-800 text-neon-blue border border-neon-blue rounded p-2" placeholder="Enter your grocery list here..."></textarea>
      <button id="startRunBtn" class="w-full cyberpunk-button-green py-2 px-4 rounded mb-4">
        Start Speed Run
      </button>
    </div>
    <div id="run-section" class="hidden">
      <div id="current-item" class="mb-4">
        <h3 class="text-lg font-semibold mb-2 text-neon-blue">Current Item:</h3>
        <p class="text-xl" id="item-name"></p>
        <p class="text-sm" id="item-quantity"></p>
        <p class="text-sm italic" id="item-note"></p>
      </div>
      <div class="flex justify-between mb-4">
        <button id="itemAddedBtn" class="cyberpunk-button-green py-2 px-4 rounded">
          Added
        </button>
        <button id="skipItemBtn" class="cyberpunk-button-red py-2 px-4 rounded">
          Skip
        </button>
      </div>
      <div id="progress" class="mb-4">
        <div class="flex justify-between text-sm mb-1">
          <span>Progress:</span>
          <span id="progress-text">0 / 0</span>
        </div>
        <div class="w-full bg-gray-700 rounded-full h-2.5">
          <div id="progress-bar" class="bg-neon-purple h-2.5 rounded-full" style="width: 0%"></div>
        </div>
      </div>
      <div id="upcoming-items" class="mt-4">
        <h3 class="text-lg font-semibold mb-2 text-neon-blue">Upcoming:</h3>
        <ul id="items-status" class="text-sm"></ul>
      </div>
    </div>
  `;
  document.body.appendChild(uiContainer);

  // Add event listeners to the buttons
  document.getElementById("startRunBtn").addEventListener("click", () => {
    const groceryList = document.getElementById("grocery-list").value;
    if (groceryList.trim() !== "") {
      processGroceryList();
    } else {
      alert("Please enter your grocery list before starting the speed run.");
    }
  });

  document.getElementById("itemAddedBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "itemAdded", status: "added" });
  });

  document.getElementById("skipItemBtn").addEventListener("click", () => {
    chrome.runtime.sendMessage({ action: "itemAdded", status: "skipped" });
  });

  // Check speed run status after adding the UI
  checkSpeedRunStatus();
}

function updateItemStatus(index, status) {
  const itemsList = document.getElementById("items-status");
  const item = itemsList.children[index];

  if (item) {
    let emoji;
    switch (status) {
      case "pending":
        emoji = "⏳";
        break;
      case "added":
        emoji = "✅";
        break;
      case "skipped":
        emoji = "❌";
        break;
      default:
        emoji = "⏳";
    }
    item.textContent = `${emoji} ${item.textContent.slice(2)}`;
  }
}

function updateSpeedrunUI(data) {
  const {
    productName,
    quantity,
    note,
    currentIndex,
    totalItems,
    nextItems,
    allItems,
  } = data;

  document.getElementById("item-name").textContent = productName;
  document.getElementById(
    "item-quantity"
  ).textContent = `Quantity: ${quantity}`;
  document.getElementById("item-note").textContent = note
    ? `Note: ${note}`
    : "";

  document.getElementById("progress-text").textContent = `${
    currentIndex + 1
  } / ${totalItems}`;
  const progressPercentage = ((currentIndex + 1) / totalItems) * 100;
  document.getElementById(
    "progress-bar"
  ).style.width = `${progressPercentage}%`;

  const upcomingItemsSection = document.getElementById("upcoming-items");
  const itemsList = document.getElementById("items-status");

  if (currentIndex + 1 < totalItems) {
    upcomingItemsSection.style.display = "block";
    itemsList.innerHTML = "";

    const nextItem = allItems[currentIndex + 1];
    itemsList.innerHTML += `<li><strong>🔜 Next:</strong> ${nextItem}</li>`;

    if (currentIndex + 2 < totalItems) {
      const onDeckItem = allItems[currentIndex + 2];
      itemsList.innerHTML += `<li><strong>🎯 On Deck:</strong> ${onDeckItem}</li>`;
    }
  } else {
    // Hide the "Upcoming" section for the final item
    upcomingItemsSection.style.display = "none";
  }

  // Update current item status
  updateItemStatus(currentIndex, "pending");
}

// Add this function to handle page changes
function handlePageChange() {
  console.log("Page changed, reinitializing UI");
  initializeExtension();
}

// Listen for page changes
window.addEventListener("load", handlePageChange);
window.addEventListener("popstate", handlePageChange);

// Start the initialization process
initializeExtension();
