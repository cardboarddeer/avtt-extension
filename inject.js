window.addEventListener("message", (event) => {
  if (event.data?.type !== "AVTT_BRIDGE_ROLL") return;

  const roll = event.data.roll;
  console.log("AVTT injected roll:", roll);

  window.EXPERIMENTAL_SETTINGS = window.EXPERIMENTAL_SETTINGS || {};
  window.EXPERIMENTAL_SETTINGS["rpgRoller"] = true;

  diceRoller.roll(
    {
      expression: roll.expression,
      rollType: roll.rollType,
      action: roll.action
    },
    false,
    20,
    2,
    undefined,
    roll.damageType || undefined
  );
});

window.addEventListener("message", (event) => {
  if (event.data?.type !== "AVTT_BRIDGE_COMMAND") return;

  const cmd = event.data.command;
  console.log("AVTT injected command:", cmd);

  if (cmd.command === "toggleDaylight") {
    const sceneKey = Object.keys(window.ScenesHandler.scenes)
      .find(k => window.ScenesHandler.scenes[k]?.id === CURRENT_SCENE_DATA.id);

    edit_scene_vision_settings(sceneKey);

    setTimeout(() => {
      const newValue =
        CURRENT_SCENE_DATA.daylight === "transparent"
          ? "rgba(255, 255, 255, 1)"
          : "transparent";

      document.querySelector('input[name="daylight"]').value = newValue;
      CURRENT_SCENE_DATA.daylight = newValue;

      [...document.querySelectorAll("button")]
        .find(b => b.innerText === "Save")
        .click();
    }, 500);
  }
});
