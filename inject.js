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

  if (cmd.command === "openGameLogTab") {
    $("#switch_gamelog").trigger("click");
    return;
  }

  if (cmd.command === "openTokensTab") {
    $("#switch_tokens").trigger("click");
    return;
  }

  if (cmd.command === "openScenesTab") {
    $("#switch_scenes").trigger("click");
    return;
  }

  if (cmd.command === "openSoundsTab") {
    $("#switch_sounds").trigger("click");
    return;
  }

  if (cmd.command === "openJournalTab") {
    $("#switch_journal").trigger("click");
    return;
  }

  if (cmd.command === "openSettingsTab") {
    $("#switch_settings").trigger("click");
    return;
  }

  if (cmd.command === "zoomIn") {
    change_zoom(ZOOM * 1.1);
    return;
  }

  if (cmd.command === "zoomOut") {
    change_zoom(ZOOM / 1.1);
    return;
  }

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
        ?.click();
    }, 500);

    return;
  }

  if (cmd.command === "toggleMarker") {
    const color = cmd.color || "#ff0000";
    const text = cmd.text || "Marked";

    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS[id];
      if (!token) return;

      const customConditions = token.options.custom_conditions || [];

      const exactMatch = customConditions.find(c =>
        c.name === color && c.text === text
      );

      if (exactMatch) {
        token.removeCondition(color);
      } else {
        token.addCondition(color, text);
      }

      token.place_sync_persist();
    });

    return;
  }

  if (cmd.command === "clearMarkers") {
    CURRENTLY_SELECTED_TOKENS.forEach(id => {
      const token = window.TOKEN_OBJECTS[id];
      if (!token) return;

      const customConditions = [...(token.options.custom_conditions || [])];
      customConditions.forEach(condition => {
        token.removeCondition(condition.name);
      });

      const nativeConditions = [...(token.options.conditions || [])];
      nativeConditions.forEach(condition => {
        const name = typeof condition === "string" ? condition : condition.name;
        if (name) token.removeCondition(name);
      });

      token.place_sync_persist();
    });

    return;
  }

  if (cmd.command === "nextInitiative") {
    const rows = [...document.querySelectorAll("#combat_area tr.CTToken")];
    if (!rows.length) return;

    const currentIndex = rows.findIndex(r => r.getAttribute("data-current") === "1");
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % rows.length;

    rows.forEach(r => r.removeAttribute("data-current"));
    rows[nextIndex].setAttribute("data-current", "1");

    update_carousel_combat_tracker?.();
    update_peer_communication_with_combat_tracker_data?.();

    console.log("AVTT next initiative:", rows[nextIndex].getAttribute("data-name"));
    return;
  }

  if (cmd.command === "previousInitiative") {
    const rows = [...document.querySelectorAll("#combat_area tr.CTToken")];
    if (!rows.length) return;

    const currentIndex = rows.findIndex(r => r.getAttribute("data-current") === "1");
    const prevIndex = currentIndex === -1
      ? rows.length - 1
      : (currentIndex - 1 + rows.length) % rows.length;

    rows.forEach(r => r.removeAttribute("data-current"));
    rows[prevIndex].setAttribute("data-current", "1");

    update_carousel_combat_tracker?.();
    update_peer_communication_with_combat_tracker_data?.();

    console.log("AVTT previous initiative:", rows[prevIndex].getAttribute("data-name"));
    return;
  }

  if (cmd.command === "rollSelectedAbility") {
    (async () => {
      try {
        const ability = (cmd.ability || "str").toLowerCase();
        const statMap = { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 };

        const tokenId = CURRENTLY_SELECTED_TOKENS?.[0];
        const token = TOKEN_OBJECTS?.[tokenId];

        if (!token) {
          console.warn("rollSelectedAbility: no selected token");
          return;
        }

        const monsterId = token.options.monster || token.options.stat || token.options.itemId;
        let monster = cached_monster_items?.[monsterId]?.monsterData;

        if (!monster) {
          console.log("rollSelectedAbility: loading monster stat", monsterId);
          open_selected_token_stat?.();
          await new Promise(resolve => setTimeout(resolve, 2500));
          monster = cached_monster_items?.[monsterId]?.monsterData;
        }

        if (!monster) {
          console.warn("rollSelectedAbility: no monster data found after loading", monsterId);
          return;
        }

        const score = monster.stats?.find(s => s.statId === statMap[ability])?.value;

        if (typeof score !== "number") {
          console.warn("rollSelectedAbility: no score found", ability);
          return;
        }

        const mod = Math.floor((score - 10) / 2);
        const sign = mod >= 0 ? `+${mod}` : `${mod}`;

        window.postMessage({
          type: "AVTT_BRIDGE_ROLL",
          roll: {
            expression: `1d20${sign}`,
            rollType: "check",
            action: `${monster.name} ${ability.toUpperCase()} Check`
          }
        }, "*");

        console.log(`rollSelectedAbility: ${monster.name} ${ability.toUpperCase()} ${score} (${sign})`);
      } catch (err) {
        console.error("rollSelectedAbility error:", err);
      }
    })();

    return;
  }

  if (cmd.command === "rollSelectedFormula") {
    (async () => {
      try {
        const formula = cmd.formula || "1d20 + {str}";
        const label = cmd.label || "Selected Token Roll";

        const statMap = { str: 1, dex: 2, con: 3, int: 4, wis: 5, cha: 6 };

        const tokenId = CURRENTLY_SELECTED_TOKENS?.[0];
        const token = TOKEN_OBJECTS?.[tokenId];

        if (!token) {
          console.warn("rollSelectedFormula: no selected token");
          return;
        }

        const monsterId = token.options.monster || token.options.stat || token.options.itemId;
        let monster = cached_monster_items?.[monsterId]?.monsterData;

        if (!monster) {
          console.log("rollSelectedFormula: loading monster stat", monsterId);
          open_selected_token_stat?.();

          await new Promise(resolve => setTimeout(resolve, 2500));

          monster = cached_monster_items?.[monsterId]?.monsterData;
        }

        if (!monster) {
          console.warn("rollSelectedFormula: no monster data found after loading", monsterId);
          return;
        }

        const getScore = (ability) =>
          monster.stats?.find(s => s.statId === statMap[ability])?.value;

        const getMod = (ability) => {
          const score = getScore(ability);
          if (typeof score !== "number") return 0;
          return Math.floor((score - 10) / 2);
        };

        const mods = {
          str: getMod("str"),
          dex: getMod("dex"),
          con: getMod("con"),
          int: getMod("int"),
          wis: getMod("wis"),
          cha: getMod("cha")
        };

        let expression = formula;

        Object.entries(mods).forEach(([key, value]) => {
          expression = expression.replaceAll(`{${key}}`, value >= 0 ? `+${value}` : `${value}`);
        });

        expression = expression
          .replace(/\s+/g, "")
          .replace(/\+\+/g, "+")
          .replace(/\+-/g, "-");

        const roll = {
          expression,
          rollType: cmd.rollType || "check",
          action: label
        };

        console.log("rollSelectedFormula sending roll:", {
          token: monster.name,
          formula,
          expression,
          label
        });

        window.postMessage({
          type: "AVTT_BRIDGE_ROLL",
          roll
        }, "*");
          } catch (err) {
        console.error("rollSelectedFormula error:", err);
      }
    })();

    return;
  }

  if (cmd.command === "rollSelectedAction") {
    (async () => {
      try {
        const actionName = cmd.action;
        const part = cmd.part || "attack"; // attack, damage, all

        const tokenId = CURRENTLY_SELECTED_TOKENS?.[0];
        const token = TOKEN_OBJECTS?.[tokenId];

        if (!token) {
          console.warn("rollSelectedAction: no selected token");
          return;
        }

        const monsterId = token.options.monster || token.options.stat || token.options.itemId;
        let monster = cached_monster_items?.[monsterId]?.monsterData;

        if (!monster) {
          console.log("rollSelectedAction: loading monster stat", monsterId);
          open_selected_token_stat?.();
          await new Promise(resolve => setTimeout(resolve, 2500));
          monster = cached_monster_items?.[monsterId]?.monsterData;
        }

        if (!monster) {
          console.warn("rollSelectedAction: no monster data found", monsterId);
          return;
        }

        const rolls = [...new DOMParser()
          .parseFromString(monster.actionsDescription || "", "text/html")
          .querySelectorAll("[data-dicenotation]")]
          .map(el => ({
            name: el.getAttribute("data-rollaction"),
            expression: el.getAttribute("data-dicenotation"),
            rollType: el.getAttribute("data-rolltype"),
            damageType: el.getAttribute("data-rolldamagetype")
          }))
          .filter(r => !actionName || r.name === actionName)
          .filter(r => {
            if (part === "all") return true;
            if (part === "attack") return r.rollType === "to hit";
            if (part === "damage") return r.rollType === "damage";
            return true;
          });

        if (!rolls.length) {
          console.warn("rollSelectedAction: no matching rolls", { actionName, part });
          return;
        }

        rolls.forEach((r, i) => {
          setTimeout(() => {
            window.postMessage({
              type: "AVTT_BRIDGE_ROLL",
              roll: {
                expression: r.expression,
                rollType: r.rollType,
                action: `${monster.name} ${r.name}`,
                damageType: r.damageType || undefined
              }
            }, "*");
          }, i * 500);
        });

        console.log("rollSelectedAction:", monster.name, actionName, part, rolls);
      } catch (err) {
        console.error("rollSelectedAction error:", err);
      }
    })();

    return;
  }

});