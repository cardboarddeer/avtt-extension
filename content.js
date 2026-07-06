document.documentElement.setAttribute("data-avtt-extension-id", chrome.runtime.id);
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


window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data?.type !== "AVTT_COMBAT_STATE") return;

  fetch("http://localhost:3000/combat-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event.data.combatState)
  }).catch(() => {});
});
