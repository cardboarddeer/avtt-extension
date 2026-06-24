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
});
