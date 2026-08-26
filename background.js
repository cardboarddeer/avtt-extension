console.log("AVTT Bridge background loaded");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_LATEST_ROLL") {
    fetch("http://localhost:3000/latest-roll")
      .then((r) => r.json())
      .then((roll) => sendResponse(roll))
      .catch(() => sendResponse(null));

    return true;
  }

  if (message.type === "GET_LATEST_COMMAND") {
    fetch("http://localhost:3000/latest-command")
      .then((r) => r.json())
      .then((command) => sendResponse(command))
      .catch(() => sendResponse(null));

    return true;
  }

  if (message.type === "GET_INFO_POPUP_IMAGE") {
    const filename = String(message.image || "").trim();

    if (!filename) {
      sendResponse({ error: "No image filename provided" });
      return true;
    }

    fetch(`http://localhost:3001/info-images/${encodeURIComponent(filename)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get("Content-Type") || "image/png";
        return response.arrayBuffer().then((buffer) => ({ buffer, contentType }));
      })
      .then(({ buffer, contentType }) => {
        let binary = "";
        const bytes = new Uint8Array(buffer);

        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }

        sendResponse({ dataUrl: `data:${contentType};base64,${btoa(binary)}` });
      })
      .catch((error) => {
        console.error("Failed to fetch info popup image:", filename, error);
        sendResponse({ error: error.message });
      });

    return true;
  }
});
