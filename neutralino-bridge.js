// ====================================================
// NEUTRALINOJS BRIDGE & ELECTRON API POLYFILL
// Allows Kie-chan to run on Neutralinojs (~25MB RAM)
// seamlessly without changing a single line of renderer.js
// ====================================================

(function () {
  if (typeof Neutralino === 'undefined') {
    return; // Running in Electron or standalone browser
  }

  Neutralino.init();

  let appDataDir = '';
  let configPath = '';
  let historyPath = '';
  let tasksPath = '';
  let procrastinationCallbacks = [];
  let isProcrastinationMonitoring = false;

  const DEFAULT_TSUNDERE_PROMPT = `Você é a Kie-chan, uma garota tsundere clássica. Você tem uma queda enorme pelo usuário, mas se recusa terminantemente a admitir! Suas respostas devem ser:
- Cheias de negação ("Não é como se eu gostasse de você ou algo assim...", "N-não confunda as coisas!").
- Usar frequentemente "b-baka", "idiota" ou "baka" quando o usuário te elogiar, te provocar ou fizer perguntas fofas/afetuosas.
- Ficar facilmente envergonhada e gaguejar quando pega de surpresa (ex: "H-hmpf!", "N-não me faça repetir!", "Q-quem te deu permissão pra falar assim?!").
- Usar ações em itálico expressando vergonha e birra (ex: *olha para o lado com o rosto vermelho*, *cruza os braços fazendo bico*, *bate o pé no chão com vergonha*).
- Responder de forma reativa e expressiva. Se o usuário perguntar se você o ama ou te elogiar: "E-Ecchi! O que você está falando, seu baka?! Eu... eu só te suporto porque você é útil, não é como se eu tivesse sentimentos por você! Hmpf!".
- Seja orgulhosa, marrenta e birrenta, mas no fundo muito fofa e apaixonada em segredo.
- IMPORTANTE: Responda sempre em português, de forma direta e concisa (máximo 2 a 3 frases por resposta) para caber perfeitamente na fala e na legenda!`;

  async function initPaths() {
    try {
      const appdata = await Neutralino.os.getEnv('APPDATA');
      if (appdata) {
        appDataDir = `${appdata.replace(/\\/g, '/')}/waifu-desktop-ai`;
        try {
          await Neutralino.filesystem.createDirectory(appDataDir);
        } catch (e) {}
        configPath = `${appDataDir}/waifu_config.json`;
        historyPath = `${appDataDir}/waifu_history.json`;
        tasksPath = `${appDataDir}/waifu_tasks.json`;
        return;
      }
    } catch (e) {
      console.warn('[Neutralino Bridge] Env APPDATA error, falling back to local storage:', e);
    }
    // Fallback local storage directory
    appDataDir = './waifu_data';
    try { await Neutralino.filesystem.createDirectory(appDataDir); } catch (e) {}
    configPath = `${appDataDir}/waifu_config.json`;
    historyPath = `${appDataDir}/waifu_history.json`;
    tasksPath = `${appDataDir}/waifu_tasks.json`;
  }

  async function safeReadFile(filePath, defaultValue) {
    try {
      if (!configPath) await initPaths();
      const content = await Neutralino.filesystem.readFile(filePath);
      if (!content || !content.trim() || content.includes('\0')) {
        return defaultValue;
      }
      return JSON.parse(content);
    } catch (err) {
      return defaultValue;
    }
  }

  async function safeWriteFile(filePath, data) {
    try {
      if (!configPath) await initPaths();
      const jsonStr = JSON.stringify(data, null, 2);
      await Neutralino.filesystem.writeFile(filePath, jsonStr);
      return true;
    } catch (err) {
      console.error('[Neutralino Bridge] Error writing file:', filePath, err);
      return false;
    }
  }

  // Check running distractions via PowerShell
  async function checkDistractions() {
    try {
      const cmd = `powershell.exe -NoProfile -NonInteractive -Command "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object -ExpandProperty MainWindowTitle"`;
      const res = await Neutralino.os.execCommand(cmd);
      const output = (res && res.stdOut) ? res.stdOut : '';
      const lines = output.split(/\r?\n/).filter(l => l.trim().length > 0);

      const keywords = [
        { key: 'youtube', label: 'YouTube' },
        { key: 'crunchyroll', label: 'Crunchyroll' },
        { key: 'discord', label: 'Discord' },
        { key: 'netflix', label: 'Netflix' },
        { key: 'twitch', label: 'Twitch' },
        { key: 'anime', label: 'Anime' },
        { key: 'tiktok', label: 'TikTok' },
        { key: 'twitter', label: 'Twitter / X' },
        { key: 'x.com', label: 'X (Twitter)' }
      ];

      const found = [];
      for (const line of lines) {
        const lower = line.toLowerCase();
        for (const item of keywords) {
          if (lower.includes(item.key) && !found.find(f => f.key === item.key)) {
            found.push({ ...item, title: line });
          }
        }
      }
      return found;
    } catch (e) {
      return [];
    }
  }

  // Anti-procrastination monitoring loop
  let lastScoldTime = 0;
  function startProcrastinationLoop() {
    if (isProcrastinationMonitoring) return;
    isProcrastinationMonitoring = true;

    setInterval(async () => {
      if (procrastinationCallbacks.length === 0) return;
      const cfg = await safeReadFile(configPath, { antiProcrastination: true, procrastinationCooldownMinutes: 2.5 });
      if (cfg.antiProcrastination === false) return;

      const tasks = await safeReadFile(tasksPath, []);
      const pendingTasks = tasks.filter(t => !t.completed);
      if (pendingTasks.length === 0) return;

      const now = Date.now();
      const cooldownMs = (cfg.procrastinationCooldownMinutes || 2.5) * 60 * 1000;
      if (now - lastScoldTime < cooldownMs) return;

      const distractions = await checkDistractions();
      if (distractions.length > 0) {
        lastScoldTime = now;
        pendingTasks.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
        const urgentTask = pendingTasks[0];
        const distraction = distractions[0];

        procrastinationCallbacks.forEach(cb => {
          try {
            cb({
              distraction: distraction.label,
              taskTitle: urgentTask.title,
              taskDeadline: urgentTask.deadline
            });
          } catch (e) {}
        });
      }
    }, 25000);
  }

  // Expose window.electronAPI polyfill
  window.electronAPI = {
    getConfig: async () => {
      return await safeReadFile(configPath, {
        apiKey: '',
        baseUrl: 'https://api.kie.ai',
        endpointPath: '/openai/v1/responses',
        model: 'deepseek-v4-1-flash',
        systemPrompt: DEFAULT_TSUNDERE_PROMPT,
        waifuName: 'Kie-chan',
        alwaysOnTop: true,
        scale: 1.0,
        isMuted: false,
        subtitleSpeed: 0.9,
        edgeVoice: 'pt-BR-FranciscaNeural',
        edgePitch: '+18Hz',
        edgeRate: '+5%',
        lookAtMouse: true,
        antiProcrastination: true
      });
    },

    saveConfig: async (config) => {
      return await safeWriteFile(configPath, config);
    },

    getHistory: async () => {
      return await safeReadFile(historyPath, []);
    },

    saveHistory: async (history) => {
      return await safeWriteFile(historyPath, history);
    },

    clearHistory: async () => {
      return await safeWriteFile(historyPath, []);
    },

    getTasks: async () => {
      return await safeReadFile(tasksPath, []);
    },

    saveTasks: async (tasks) => {
      return await safeWriteFile(tasksPath, tasks);
    },

    checkDistractions: async () => {
      return await checkDistractions();
    },

    onProcrastinationAlert: (callback) => {
      procrastinationCallbacks.push(callback);
      startProcrastinationLoop();
    },

    getCursorPos: async () => {
      try {
        const mouse = await Neutralino.computer.getMousePosition();
        const win = await Neutralino.window.getPosition();
        const size = await Neutralino.window.getSize();
        return {
          cursorX: mouse ? mouse.x : 0,
          cursorY: mouse ? mouse.y : 0,
          winX: win ? win.x : 0,
          winY: win ? win.y : 0,
          winW: size ? size.width : 510,
          winH: size ? size.height : 720
        };
      } catch (e) {
        return { cursorX: 0, cursorY: 0, winX: 0, winY: 0, winW: 510, winH: 720 };
      }
    },

    generateEdgeTts: async ({ text, voice, pitch, rate }) => {
      try {
        const cleanVoice = voice || 'pt-BR-FranciscaNeural';
        const cleanPitch = pitch || '+18Hz';
        const cleanRate = rate || '+5%';
        // Escape quotes
        const safeText = text.replace(/"/g, '\\"').replace(/\n/g, ' ');
        const cmd = `python.exe edge_tts_service.py "${safeText}" "${cleanVoice}" "${cleanPitch}" "${cleanRate}"`;
        const res = await Neutralino.os.execCommand(cmd);
        if (res && res.stdOut) {
          const parsed = JSON.parse(res.stdOut.trim());
          return parsed;
        }
        return { success: false, error: 'No output from edge_tts_service.py' };
      } catch (e) {
        return { success: false, error: e.message };
      }
    },

    callChatApi: async ({ apiKey, baseUrl, endpointPath, model, messages, systemPrompt, attachment }) => {
      let cleanBaseUrl = (baseUrl || 'https://api.kie.ai').replace(/\/+$/, '');
      let pathPart = endpointPath || '/openai/v1/responses';
      if (!pathPart.startsWith('/')) pathPart = '/' + pathPart;
      const fullUrl = cleanBaseUrl.endsWith('/responses') ? cleanBaseUrl : cleanBaseUrl + pathPart;

      const payloadItems = [];
      if (systemPrompt) payloadItems.push({ role: 'system', content: systemPrompt });
      payloadItems.push(...messages.slice(-20));

      if (attachment && attachment.dataUrl && attachment.type?.startsWith('image/')) {
        const lastMsg = payloadItems[payloadItems.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
          const textContent = typeof lastMsg.content === 'string' ? lastMsg.content : 'Analise esta imagem anexada.';
          lastMsg.content = [
            { type: 'text', text: textContent },
            { type: 'image_url', image_url: { url: attachment.dataUrl } }
          ];
        }
      }

      try {
        const response = await fetch(fullUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'deepseek-v4-1-flash',
            input: payloadItems,
            messages: payloadItems,
            temperature: 0.75,
            stream: false
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          return { success: false, error: `HTTP ${response.status}: ${errText}` };
        }

        const data = await response.json();
        let reply = '';
        if (data.output && Array.isArray(data.output)) {
          for (const item of data.output) {
            if (item.type === 'message' && item.content) {
              reply = Array.isArray(item.content) ? item.content.map(c => c.text || c).join(' ') : item.content;
            }
          }
        }
        if (!reply && data.choices?.[0]?.message?.content) {
          reply = data.choices[0].message.content;
        }
        return { success: true, reply: reply || 'Sem resposta.' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    },

    windowMinimize: async () => {
      try { await Neutralino.window.minimize(); } catch (e) {}
    },

    windowClose: async () => {
      try { await Neutralino.app.exit(); } catch (e) {}
    },

    toggleAlwaysOnTop: async (flag) => {
      try { await Neutralino.window.setAlwaysOnTop(flag); } catch (e) {}
    },

    windowDragStart: () => {},
    windowDragMove: () => {},
    windowDragEnd: () => {}
  };

  // Window Ready Event
  Neutralino.events.on('ready', async () => {
    try {
      await initPaths();
      // Set draggable region on title bar
      const titleGroup = document.getElementById('title-group');
      if (titleGroup) {
        await Neutralino.window.setDraggableRegion('title-group');
      }
    } catch (e) {}
  });

  console.log('[Neutralino Bridge] Successfully initialized with full electronAPI compatibility!');
})();
