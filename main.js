const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Set Application Name & Taskbar/Task Manager Identity
app.setName('Kie-Chan!');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.kieai.kiechan');
}

let mainWindow = null;
const configPath = path.join(app.getPath('userData'), 'waifu_config.json');
const historyPath = path.join(app.getPath('userData'), 'waifu_history.json');
const tasksPath = path.join(app.getPath('userData'), 'waifu_tasks.json');

const DEFAULT_TSUNDERE_PROMPT = `Você é a Kie-chan, uma garota tsundere clássica. Você tem uma queda enorme pelo usuário, mas se recusa terminantemente a admitir! Suas respostas devem ser:
- Cheias de negação ("Não é como se eu gostasse de você ou algo assim...", "N-não confunda as coisas!").
- Usar frequentemente "b-baka", "idiota" ou "baka" quando o usuário te elogiar, te provocar ou fizer perguntas fofas/afetuosas.
- Ficar facilmente envergonhada e gaguejar quando pega de surpresa (ex: "H-hmpf!", "N-não me faça repetir!", "Q-quem te deu permissão pra falar assim?!").
- Usar ações em itálico expressando vergonha e birra (ex: *olha para o lado com o rosto vermelho*, *cruza os braços fazendo bico*, *bate o pé no chão com vergonha*).
- Responder de forma reativa e expressiva. Se o usuário perguntar se você o ama ou te elogiar: "E-Ecchi! O que você está falando, seu baka?! Eu... eu só te suporto porque você é útil, não é como se eu tivesse sentimentos por você! Hmpf!".
- Seja orgulhosa, marrenta e birrenta, mas no fundo muito fofa e apaixonada em segredo.
- IMPORTANTE: Responda sempre em português, de forma direta e concisa (máximo 2 a 3 frases por resposta) para caber perfeitamente na fala e na legenda!`;

// Safe Atomic File I/O (Resistant to BSOD, power cuts and truncation)
function safeReadJson(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      // If corrupted with null bytes (\0) or empty from crash
      if (!raw || raw.trim().length === 0 || raw.includes('\0')) {
        console.warn(`[SafeIO] Detected corrupted zero-filled file at ${filePath}. Attempting backup restoration...`);
        const bakPath = filePath + '.bak';
        if (fs.existsSync(bakPath)) {
          const bakRaw = fs.readFileSync(bakPath, 'utf-8');
          if (bakRaw && !bakRaw.includes('\0')) {
            const parsed = JSON.parse(bakRaw);
            safeWriteJson(filePath, parsed);
            return parsed;
          }
        }
        safeWriteJson(filePath, defaultValue);
        return defaultValue;
      }
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error(`[SafeIO] Error reading ${filePath}:`, e.message);
    const bakPath = filePath + '.bak';
    try {
      if (fs.existsSync(bakPath)) {
        const bakRaw = fs.readFileSync(bakPath, 'utf-8');
        if (bakRaw && !bakRaw.includes('\0')) {
          return JSON.parse(bakRaw);
        }
      }
    } catch (e2) {}
  }
  return defaultValue;
}

function safeWriteJson(filePath, data) {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const tmpPath = filePath + '.tmp';
    const bakPath = filePath + '.bak';
    // 1. Write to temporary file
    fs.writeFileSync(tmpPath, jsonStr, 'utf-8');
    // 2. Atomic rename to target file (prevents zero-byte corruption on crash)
    fs.renameSync(tmpPath, filePath);
    // 3. Keep a backup copy in case of future OS crash/BSOD
    fs.writeFileSync(bakPath, jsonStr, 'utf-8');
    return true;
  } catch (e) {
    console.error(`[SafeIO] Error atomically writing ${filePath}:`, e.message);
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (e2) {
      return false;
    }
  }
}

function loadConfig() {
  const defaultConfig = {
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
    speechRate: 1.0,
    speechPitch: 1.2,
    sttProvider: 'webspeech',
    sttUrl: '',
    lookAtMouse: true,
    antiProcrastination: true,
    procrastinationCooldownMinutes: 2.5
  };

  const cfg = safeReadJson(configPath, defaultConfig);
  if (cfg.model === 'deepseek-v4.1-flash') cfg.model = 'deepseek-v4-1-flash';
  if (!cfg.endpointPath) cfg.endpointPath = '/openai/v1/responses';
  if (!cfg.baseUrl || cfg.baseUrl === 'https://api.kie.ai/v1') cfg.baseUrl = 'https://api.kie.ai';
  if (!cfg.systemPrompt || cfg.systemPrompt.includes('assistente virtual do usuário, carinhosa, fofa, inteligente e prestativa')) {
    cfg.systemPrompt = DEFAULT_TSUNDERE_PROMPT;
  }
  return { ...defaultConfig, ...cfg };
}

function saveConfig(config) {
  return safeWriteJson(configPath, config);
}

function loadHistory() {
  return safeReadJson(historyPath, []);
}

function saveHistory(history) {
  return safeWriteJson(historyPath, history);
}

function loadTasks() {
  return safeReadJson(tasksPath, []);
}

function saveTasks(tasks) {
  return safeWriteJson(tasksPath, tasks);
}

function createWindow() {
  const config = loadConfig();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const winWidth = 510;
  const winHeight = 720;
  const x = Math.max(0, screenWidth - winWidth - 40);
  const y = Math.max(0, screenHeight - winHeight - 40);

  const iconPath = path.join(__dirname, process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  mainWindow = new BrowserWindow({
    title: 'Kie-Chan!',
    icon: iconPath,
    width: winWidth,
    height: winHeight,
    x: x,
    y: y,
    transparent: true,
    frame: false,
    alwaysOnTop: config.alwaysOnTop !== false,
    hasShadow: false,
    resizable: true,
    minWidth: 280,
    minHeight: 380,
    maxWidth: 1400,
    maxHeight: 1600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-config', () => {
  return loadConfig();
});

ipcMain.handle('save-config', (event, newConfig) => {
  return saveConfig(newConfig);
});

ipcMain.handle('get-history', () => {
  return loadHistory();
});

ipcMain.handle('save-history', (event, history) => {
  return saveHistory(history);
});

ipcMain.handle('clear-history', () => {
  saveHistory([]);
  return true;
});

// Tasks & Anti-Procrastination IPC Handlers
ipcMain.handle('get-tasks', () => {
  return loadTasks();
});

ipcMain.handle('save-tasks', (event, tasks) => {
  return saveTasks(tasks);
});

// Cursor Screen Position for Look-at-Mouse feature
ipcMain.handle('get-cursor-pos', () => {
  if (!mainWindow) return { cursorX: 0, cursorY: 0, winX: 0, winY: 0, winW: 460, winH: 720 };
  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = mainWindow.getPosition();
  const [winW, winH] = mainWindow.getSize();
  return {
    cursorX: cursor.x,
    cursorY: cursor.y,
    winX,
    winY,
    winW,
    winH
  };
});

// Distraction detection via PowerShell window titles and process inspection
function checkDistractions() {
  return new Promise((resolve) => {
    const cmd = `powershell -NoProfile -NonInteractive -Command "$ErrorActionPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Process | ForEach-Object { if ($_.MainWindowTitle) { $_.MainWindowTitle } else if ($_.ProcessName -match 'discord') { 'Discord' } }"`;
    const { exec } = require('child_process');
    exec(cmd, { windowsHide: true, timeout: 5000 }, (err, stdout) => {
      if (err || !stdout) return resolve([]);
      const lines = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
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
          if (lower.includes(item.key)) {
            if (!found.find(f => f.key === item.key)) {
              found.push({ ...item, title: line });
            }
          }
        }
      }
      resolve(found);
    });
  });
}

ipcMain.handle('check-distractions', async () => {
  return await checkDistractions();
});

// Anti-Procrastination Monitoring Loop
let lastScoldTime = 0;
setInterval(async () => {
  if (!mainWindow) return;
  const cfg = loadConfig();
  if (cfg.antiProcrastination === false) return;

  const tasks = loadTasks();
  const pendingTasks = tasks.filter(t => !t.completed);
  if (pendingTasks.length === 0) return;

  // Cooldown check (default 2.5 minutes between scoldings so it doesn't spam)
  const now = Date.now();
  const cooldownMs = (cfg.procrastinationCooldownMinutes || 2.5) * 60 * 1000;
  if (now - lastScoldTime < cooldownMs) return;

  const distractions = await checkDistractions();
  if (distractions.length > 0) {
    lastScoldTime = now;
    // pick earliest deadline or most urgent task
    pendingTasks.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    const urgentTask = pendingTasks[0];
    const distraction = distractions[0];

    mainWindow.webContents.send('procrastination-alert', {
      distraction: distraction.label,
      taskTitle: urgentTask.title,
      taskDeadline: urgentTask.deadline
    });
  }
}, 25000);

// IPC Handler to synthesize real Neural Edge TTS via edge_tts_service.py
ipcMain.handle('generate-edge-tts', async (event, { text, voice, pitch, rate }) => {
  return new Promise((resolve) => {
    const cleanVoice = voice || 'pt-BR-FranciscaNeural';
    const cleanPitch = pitch || '+18Hz';
    const cleanRate = rate || '+5%';

    const py = spawn('python.exe', [
      path.join(__dirname, 'edge_tts_service.py'),
      text,
      cleanVoice,
      cleanPitch,
      cleanRate
    ]);

    let stdout = '';
    let stderr = '';
    py.stdout.on('data', (d) => { stdout += d.toString(); });
    py.stderr.on('data', (d) => { stderr += d.toString(); });

    py.on('close', (code) => {
      if (code === 0 && stdout) {
        try {
          const res = JSON.parse(stdout.trim());
          resolve(res);
        } catch (e) {
          resolve({ success: false, error: 'JSON parse error' });
        }
      } else {
        resolve({ success: false, error: stderr || 'Error code: ' + code });
      }
    });
  });
});

let isDragging = false;
let dragOffset = { x: 0, y: 0 };

ipcMain.on('window-drag-start', () => {
  if (!mainWindow) return;
  const cursor = screen.getCursorScreenPoint();
  const [winX, winY] = mainWindow.getPosition();
  dragOffset = { x: cursor.x - winX, y: cursor.y - winY };
  isDragging = true;
});

ipcMain.on('window-drag-move', () => {
  if (!mainWindow || !isDragging) return;
  const cursor = screen.getCursorScreenPoint();
  mainWindow.setPosition(cursor.x - dragOffset.x, cursor.y - dragOffset.y);
});

ipcMain.on('window-drag-end', () => {
  isDragging = false;
});

ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('toggle-always-on-top', (event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(flag);
    return mainWindow.isAlwaysOnTop();
  }
  return false;
});

// IPC Handler to call Kie.ai DeepSeek API with POST /openai/v1/responses
ipcMain.handle('call-chat-api', async (event, { apiKey, baseUrl, endpointPath, model, messages, systemPrompt, attachment }) => {
  try {
    let cleanBaseUrl = (baseUrl || 'https://api.kie.ai').replace(/\/+$/, '');
    let pathPart = endpointPath || '/openai/v1/responses';
    if (!pathPart.startsWith('/')) pathPart = '/' + pathPart;

    let fullUrl;
    if (cleanBaseUrl.endsWith('/responses')) {
      fullUrl = cleanBaseUrl;
    } else {
      fullUrl = cleanBaseUrl + pathPart;
    }

    const payloadItems = [];
    if (systemPrompt) {
      payloadItems.push({ role: 'system', content: systemPrompt });
    }
    // send full conversation history for context window (last 20 messages)
    const contextSlice = JSON.parse(JSON.stringify(messages.slice(-20)));
    payloadItems.push(...contextSlice);

    // Format vision attachment if present
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

    const body = {
      model: model || 'deepseek-v4-1-flash',
      input: payloadItems,
      messages: payloadItems,
      temperature: 0.75,
      stream: false
    };

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errText}`
      };
    }

    const data = await response.json();
    let reply = '';

    // 1. OpenAI Responses API output format:
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          if (Array.isArray(item.content)) {
            reply = item.content.map(c => (typeof c === 'object' ? c.text || JSON.stringify(c) : c)).join(' ');
          } else if (typeof item.content === 'string') {
            reply = item.content;
          }
        }
      }
    }

    // 2. output_text property
    if (!reply && data.output_text) {
      reply = data.output_text;
    }

    // 3. Choices fallback
    if (!reply && data.choices?.[0]?.message?.content) {
      reply = data.choices[0].message.content;
    }

    // 4. Other fallbacks
    if (!reply && data.message) {
      reply = typeof data.message === 'string' ? data.message : data.message.content || '';
    }

    if (!reply) {
      reply = typeof data === 'string' ? data : JSON.stringify(data);
    }

    return {
      success: true,
      reply: reply.trim(),
      raw: data
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Erro de conexão com a API'
    };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
