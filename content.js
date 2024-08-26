// Add the search bar to the page
function addSearchBar() {
  const amazonSearchContainer = document.querySelector("#nav-search-bar-form");
  if (amazonSearchContainer) {
    // Create a wrapper for both search bars
    const searchWrapper = document.createElement("div");
    searchWrapper.id = "search-wrapper";

    // Move the Amazon search into the wrapper
    searchWrapper.appendChild(amazonSearchContainer.cloneNode(true));

    // Create our custom search bar
    const searchBarContainer = document.createElement("div");
    searchBarContainer.id = "grocery-list-container";

    const searchBar = document.createElement("textarea");
    searchBar.id = "grocery-list";
    searchBar.placeholder = "Enter your grocery list here...";
    searchBarContainer.appendChild(searchBar);

    const submitButton = document.createElement("button");
    submitButton.textContent = "Add to Cart";
    submitButton.addEventListener("click", processGroceryList);
    searchBarContainer.appendChild(submitButton);

    // Add our custom search bar to the wrapper
    searchWrapper.appendChild(searchBarContainer);

    // Replace the original Amazon search with our wrapper
    amazonSearchContainer.parentNode.replaceChild(
      searchWrapper,
      amazonSearchContainer
    );
  } else {
    console.error(
      "Could not find Amazon search container to append our search bar"
    );
  }
}

// Process the grocery list
function processGroceryList() {
  const groceryList = document.getElementById("grocery-list").value;
  const groceryArray = groceryList
    .split("\n")
    .filter((item) => item.trim() !== "");

  console.log("Grocery Array:", groceryArray);
  console.log("Array size:", groceryArray.length);

  // Send a message to the background script
  try {
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
  } catch (error) {
    console.error("Error sending message:", error);
    handleExtensionReload();
  }
}

function handleExtensionReload() {
  console.log("Extension context invalidated. Attempting to recover...");
  // Remove existing elements
  const existingWrapper = document.getElementById("search-wrapper");
  if (existingWrapper) {
    existingWrapper.remove();
  }
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
  const targetNode = document.body;
  const config = { childList: true, subtree: true };

  const callback = function (mutationsList, observer) {
    for (let mutation of mutationsList) {
      if (mutation.type === "childList") {
        const amazonSearchContainer = document.querySelector(
          "#nav-search-bar-form"
        );
        if (
          amazonSearchContainer &&
          !document.querySelector("#grocery-list-container")
        ) {
          addSearchBar();
          addPopup();
          observer.disconnect();
          break;
        }
      }
    }
  };

  const observer = new MutationObserver(callback);
  observer.observe(targetNode, config);
}

// Start the initialization process
initializeExtension();

// Add a message listener to receive messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === "showCompletionPopup") {
      const popup = document.getElementById("shopping-complete-popup");
      const finalTimeElement = document.getElementById("final-time");
      if (popup && finalTimeElement) {
        finalTimeElement.textContent = `Your time: ${message.time}`;
        popup.style.display = "block";

        // Trigger confetti animation
        startConfetti();

        setTimeout(() => {
          popup.style.display = "none";
          stopConfetti();
        }, 10000);
      }
    } else if (message.action === "updateStopwatch") {
      const stopwatchElement = document.getElementById("stopwatch");
      if (stopwatchElement) {
        stopwatchElement.textContent = `Time: ${message.time}`;
      }
    }
  } catch (error) {
    console.error("Error in message listener:", error);
    handleExtensionReload();
  }
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
