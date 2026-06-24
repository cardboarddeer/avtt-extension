console.log("AVTT Bridge content loaded");

const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
document.documentElement.appendChild(script);

setInterval(() => {
  chrome.runtime.sendMessage({ type: "GET_LATEST_ROLL" }, (roll) => {
    if (!roll) return;

    console.log("Received roll:", roll);

    window.postMessage({
      type: "AVTT_BRIDGE_ROLL",
      roll
    }, "*");
  });

  chrome.runtime.sendMessage({ type: "GET_LATEST_COMMAND" }, (command) => {
    if (!command) return;

    console.log("Received command:", command);

    window.postMessage({
      type: "AVTT_BRIDGE_COMMAND",
      command
    }, "*");
  });
}, 1000);
