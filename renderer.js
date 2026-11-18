import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEFAULT_TSUNDERE_PROMPT = `Você é a Kie-chan, uma garota tsundere clássica. Você tem uma queda enorme pelo usuário, mas se recusa terminantemente a admitir! Suas respostas devem ser:
- Cheias de negação ("Não é como se eu gostasse de você ou algo assim...", "N-não confunda as coisas!").
- Usar frequentemente "b-baka", "idiota" ou "baka" quando o usuário te elogiar, te provocar ou fizer perguntas fofas/afetuosas.
- Ficar facilmente envergonhada e gaguejar quando pega de surpresa (ex: "H-hmpf!", "N-não me faça repetir!", "Q-quem te deu permissão pra falar assim?!").
- Usar ações em itálico expressando vergonha e birra (ex: *olha para o lado com o rosto vermelho*, *cruza os braços fazendo bico*, *bate o pé no chão com vergonha*).
- Responder de forma reativa e expressiva. Se o usuário perguntar se você o ama ou te elogiar: "E-Ecchi! O que você está falando, seu baka?! Eu... eu só te suporto porque você é útil, não é como se eu tivesse sentimentos por você! Hmpf!".
- Seja orgulhosa, marrenta e birrenta, mas no fundo muito fofa e apaixonada em segredo.
- IMPORTANTE: Responda sempre em português, de forma direta e concisa (máximo 2 a 3 frases por resposta) para caber perfeitamente na fala e na legenda!`;

// Global Configuration
let config = {
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

let conversationHistory = [];
let tasksList = [];
let scene, camera, renderer, controls, characterGroup;
let ambientLight, mainDirLight, fillLight, rimLight;
let currentScale = 1.0;
let initialCameraPos = { x: 0, y: 0.8, z: 2.2 };
let isThinking = false;

// 3D Look at Mouse State
let headBone = null;
let neckBone = null;
let initialHeadQuat = new THREE.Quaternion();
let initialNeckQuat = new THREE.Quaternion();
let targetHeadLook = { x: 0, y: 0 };
let lookAtMouseEnabled = true;

// Active Attachment State
let currentAttachment = null; // { name, size, type, dataUrl, textContent }

// Audio & Recording state
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = 0;
let recordingTimerInterval = null;
let speechRecognizer = null;
let interimTranscript = '';
let finalTranscript = '';
let isRecording = false;

// Subtitle & Karaoke Engine state
let activeSubtitleTimeout = null;
let currentAudio = null;

// DOM Elements
const canvasContainer = document.getElementById('canvas-container');
const subtitlesContainer = document.getElementById('subtitles-container');
const thinkingIndicator = document.getElementById('thinking-indicator');
const thinkingText = document.getElementById('thinking-text');

const commandBar = document.getElementById('command-bar');
const promptInput = document.getElementById('prompt-input');
const btnCmdHistory = document.getElementById('btn-cmd-history');
const btnCmdSettings = document.getElementById('btn-cmd-settings');
const btnPromptMic = document.getElementById('btn-prompt-mic');
const btnPromptSend = document.getElementById('btn-prompt-send');

const recordingPill = document.getElementById('recording-pill');
const recordingTimer = document.getElementById('recording-timer');
const btnStopRecordingPill = document.getElementById('btn-stop-recording-pill');

const btnMute = document.getElementById('btn-mute');
const btnHistory = document.getElementById('btn-history');
const btnLookMouse = document.getElementById('btn-look-mouse');
const btnTasks = document.getElementById('btn-tasks');
const btnMicTop = document.getElementById('btn-mic-top');
const btnPin = document.getElementById('btn-pin');
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnResetCam = document.getElementById('btn-reset-cam');
const btnSettings = document.getElementById('btn-settings');
const btnMinimize = document.getElementById('btn-minimize');
const btnClose = document.getElementById('btn-close');

// Attachment Elements
const btnAttach = document.getElementById('btn-attach');
const fileInput = document.getElementById('file-input');
const attachmentPreview = document.getElementById('attachment-preview');
const attachmentIcon = document.getElementById('attachment-icon');
const attachmentName = document.getElementById('attachment-name');
const btnRemoveAttachment = document.getElementById('btn-remove-attachment');

// Tasks & Anti-Procrastination Modal Elements
const tasksModal = document.getElementById('tasks-modal');
const btnCloseTasks = document.getElementById('btn-close-tasks');
const btnDismissTasks = document.getElementById('btn-dismiss-tasks');
const toggleAntiProc = document.getElementById('toggle-anti-proc');
const newTaskTitle = document.getElementById('new-task-title');
const newTaskDeadline = document.getElementById('new-task-deadline');
const btnAddTask = document.getElementById('btn-add-task');
const tasksListEl = document.getElementById('tasks-list');
const tasksCountBadge = document.getElementById('tasks-count-badge');
const cfgLookMouse = document.getElementById('cfg-look-mouse');
const cfgAntiProc = document.getElementById('cfg-anti-proc');

// History Modal elements
const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');
const historyCountBadge = document.getElementById('history-count-badge');
const btnCloseHistory = document.getElementById('btn-close-history');
const btnDismissHistory = document.getElementById('btn-dismiss-history');
const btnClearHistory = document.getElementById('btn-clear-history');

// Settings modal elements
const settingsModal = document.getElementById('settings-modal');
const btnCloseSettings = document.getElementById('btn-close-settings');
const btnCancelSettings = document.getElementById('btn-cancel-settings');
const btnSaveSettings = document.getElementById('btn-save-settings');
const cfgApiKey = document.getElementById('cfg-api-key');
const cfgBaseUrl = document.getElementById('cfg-base-url');
const cfgEndpointPath = document.getElementById('cfg-endpoint-path');
const cfgModel = document.getElementById('cfg-model');
const cfgWaifuName = document.getElementById('cfg-waifu-name');
const cfgSystemPrompt = document.getElementById('cfg-system-prompt');
const cfgModelScale = document.getElementById('cfg-model-scale');
const scaleVal = document.getElementById('scale-val');
const cfgMuteToggle = document.getElementById('cfg-mute-toggle');
const cfgSubSpeed = document.getElementById('cfg-sub-speed');
const subSpeedVal = document.getElementById('sub-speed-val');
const cfgEdgeVoice = document.getElementById('cfg-edge-voice');
const cfgEdgePitch = document.getElementById('cfg-edge-pitch');
const edgePitchVal = document.getElementById('edge-pitch-val');
const cfgSttProvider = document.getElementById('cfg-stt-provider');
const groupCustomStt = document.getElementById('group-custom-stt');
const cfgSttUrl = document.getElementById('cfg-stt-url');

// Initialize Application
async function init() {
  // 1. Hook up all UI event listeners immediately so buttons and hotkeys are always active
  setupEventListeners();

  // 2. Load configurations and data with full resilience
  if (window.electronAPI) {
    try {
      const savedConfig = await window.electronAPI.getConfig();
      if (savedConfig) {
        config = { ...config, ...savedConfig };
        if (config.model === 'deepseek-v4.1-flash') config.model = 'deepseek-v4-1-flash';
        if (!config.endpointPath) config.endpointPath = '/openai/v1/responses';
        if (!config.baseUrl || config.baseUrl === 'https://api.kie.ai/v1') config.baseUrl = 'https://api.kie.ai';
        if (!config.systemPrompt || config.systemPrompt.includes('assistente virtual do usuário, carinhosa, fofa, inteligente e prestativa')) {
          config.systemPrompt = DEFAULT_TSUNDERE_PROMPT;
        }
        currentScale = config.scale || 1.0;
        lookAtMouseEnabled = config.lookAtMouse !== false;
      }
    } catch (e) {
      console.warn('Error reading config:', e);
    }

    try {
      const savedHistory = await window.electronAPI.getHistory();
      if (Array.isArray(savedHistory)) {
        conversationHistory = savedHistory;
      }
    } catch (e) {
      console.warn('Error reading history:', e);
    }

    try {
      if (window.electronAPI.getTasks) {
        const savedTasks = await window.electronAPI.getTasks();
        if (Array.isArray(savedTasks)) {
          tasksList = savedTasks;
        }
      }
    } catch (e) {
      console.warn('Error reading tasks:', e);
    }

    try {
      if (window.electronAPI.onProcrastinationAlert) {
        window.electronAPI.onProcrastinationAlert((alertData) => {
          handleProcrastinationAlert(alertData);
        });
      }
    } catch (e) {}
  }

  updateUIFromConfig();
  updateTasksBadge();

  // 3. Initialize 3D Engine, Voice and Cursor Tracking
  try {
    setupThreeScene();
    loadCharacterModel();
  } catch (e) {
    console.error('Three.js scene initialization error:', e);
  }

  try {
    setupSpeechRecognition();
  } catch (e) {}

  try {
    setupCursorTracking();
  } catch (e) {}

  // Welcome line with tsundere greeting
  setTimeout(() => {
    if (!config.apiKey) {
      playSubtitles(`*olha para o lado* O-olha só... se você não colocar sua API Key nas ⚙️, como eu vou responder suas perguntas bobas, b-baka?!`);
    } else {
      playSubtitles(`*cruza os braços* O que foi agora? Aperte [/] logo se tiver algo pra falar, b-baka!`);
    }
  }, 1000);
}

// ----------------------------------------------------
// THREE.JS 3D SCENE & MODEL
// ----------------------------------------------------
function setupThreeScene() {
  scene = new THREE.Scene();

  const width = canvasContainer.clientWidth || window.innerWidth;
  const height = canvasContainer.clientHeight || window.innerHeight;

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(initialCameraPos.x, initialCameraPos.y, initialCameraPos.z);

  renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  canvasContainer.appendChild(renderer.domElement);

  ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
  scene.add(ambientLight);

  mainDirLight = new THREE.DirectionalLight(0xfff5f8, 1.2);
  mainDirLight.position.set(3, 5, 4);
  scene.add(mainDirLight);

  fillLight = new THREE.DirectionalLight(0xdff9fb, 0.8);
  fillLight.position.set(-3, 3, 2);
  scene.add(fillLight);

  rimLight = new THREE.DirectionalLight(0xff80bf, 0.6);
  rimLight.position.set(0, 4, -3);
  scene.add(rimLight);

  characterGroup = new THREE.Group();
  scene.add(characterGroup);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0.75, 0);
  controls.maxDistance = 6.0;
  controls.minDistance = 0.5;
  controls.enablePan = true;
  controls.mouseButtons = {
    LEFT: THREE.MOUSE.ROTATE,
    MIDDLE: THREE.MOUSE.DOLLY,
    RIGHT: THREE.MOUSE.ROTATE
  };

  window.addEventListener('resize', onWindowResize);

  let clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);

    const elapsedTime = clock.getElapsedTime();

    if (characterGroup) {
      characterGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.012;
      characterGroup.rotation.y = Math.sin(elapsedTime * 0.8) * 0.035;
    }

    // Look at Mouse Head & Neck Bone Tracking (Quaternion Slerp: stable, smooth & NaN-safe)
    if (lookAtMouseEnabled && headBone && isFinite(targetHeadLook.x) && isFinite(targetHeadLook.y)) {
      const targetYaw = THREE.MathUtils.clamp(targetHeadLook.x, -0.45, 0.45);
      const targetPitch = THREE.MathUtils.clamp(targetHeadLook.y, -0.25, 0.25);
      const lookEuler = new THREE.Euler(targetPitch, targetYaw, 0, 'YXZ');
      const offsetQuat = new THREE.Quaternion().setFromEuler(lookEuler);
      const targetHeadQ = initialHeadQuat.clone().multiply(offsetQuat);
      headBone.quaternion.slerp(targetHeadQ, 0.1);

      if (neckBone) {
        const neckEuler = new THREE.Euler(targetPitch * 0.35, targetYaw * 0.35, 0, 'YXZ');
        const neckOffsetQuat = new THREE.Quaternion().setFromEuler(neckEuler);
        const targetNeckQ = initialNeckQuat.clone().multiply(neckOffsetQuat);
        neckBone.quaternion.slerp(targetNeckQ, 0.1);
      }
    } else if (headBone) {
      headBone.quaternion.slerp(initialHeadQuat, 0.1);
      if (neckBone) {
        neckBone.quaternion.slerp(initialNeckQuat, 0.1);
      }
    }

    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}

function loadCharacterModel() {
  const loader = new GLTFLoader();
  const modelPath = '3d_anime_character_girl_for_blender_c1.glb';

  loader.load(
    modelPath,
    (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      model.position.x = -center.x;
      model.position.y = -box.min.y;
      model.position.z = -center.z;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
        if (child.isBone) {
          if (child.name === 'Head_47') {
            headBone = child;
            initialHeadQuat.copy(child.quaternion);
          } else if (child.name === 'Neck_48') {
            neckBone = child;
            initialNeckQuat.copy(child.quaternion);
          }
        }
      });

      characterGroup.add(model);
      applyScale(currentScale);

      controls.target.set(0, size.y * 0.55, 0);
      camera.position.set(0, size.y * 0.55, size.y * 1.5);
      controls.update();
      console.log('3D Anime Character model loaded successfully!');
    },
    undefined,
    (error) => {
      console.error('Error loading 3D model:', error);
      playSubtitles('Erro ao carregar o modelo 3D!');
    }
  );
}

function onWindowResize() {
  const width = canvasContainer.clientWidth || window.innerWidth;
  const height = canvasContainer.clientHeight || window.innerHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

function applyScale(scale) {
  currentScale = Math.max(0.3, Math.min(3.0, scale));
  if (characterGroup) {
    characterGroup.scale.set(currentScale, currentScale, currentScale);
  }
  if (cfgModelScale) cfgModelScale.value = currentScale;
  if (scaleVal) scaleVal.innerText = currentScale.toFixed(1);
}

// ----------------------------------------------------
// ANIME SUBTITLES: PACED, CLEAR & COMFORTABLE READING
// ----------------------------------------------------
function cleanTextForSpeech(text) {
  return text
    .replace(/\*[^*]+\*/g, '')
    .replace(/[#*_`~>]/g, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .trim();
}

function chunkText(text, maxWords = 11) {
  // Split primarily by sentence punctuation, fallback to maxWords
  const rawSentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
  const chunks = [];

  rawSentences.forEach(sentence => {
    const words = sentence.trim().split(/\s+/).filter(w => w.trim().length > 0);
    if (words.length <= maxWords) {
      if (words.length > 0) chunks.push(words);
    } else {
      // split into smaller batches of maxWords
      for (let i = 0; i < words.length; i += maxWords) {
        chunks.push(words.slice(i, i + maxWords));
      }
    }
  });

  return chunks.length > 0 ? chunks : [text.split(/\s+/)];
}

async function playSubtitles(fullText) {
  if (activeSubtitleTimeout) clearTimeout(activeSubtitleTimeout);
  if (currentAudio) {
    try { currentAudio.pause(); } catch (e) {}
    currentAudio = null;
  }
  window.speechSynthesis.cancel();

  // If text contains actions like *sorri*, keep text visible in subtitle
  const displayCleanText = fullText.replace(/[#*_`~>]/g, '').trim();
  const speechCleanText = cleanTextForSpeech(fullText);

  if (!displayCleanText) return;

  // 1. IF NOT MUTED: TRY REAL NEURAL EDGE TTS FIRST
  if (!config.isMuted && window.electronAPI && window.electronAPI.generateEdgeTts && speechCleanText) {
    try {
      const edgeRes = await window.electronAPI.generateEdgeTts({
        text: speechCleanText,
        voice: config.edgeVoice || 'pt-BR-FranciscaNeural',
        pitch: config.edgePitch || '+18Hz',
        rate: config.edgeRate || '+5%'
      });

      if (edgeRes && edgeRes.success && edgeRes.audio) {
        currentAudio = new Audio(edgeRes.audio);
        await currentAudio.play();
        renderSubtitlesSyncedWithAudio(displayCleanText, currentAudio);
        return;
      }
    } catch (err) {
      console.warn('Edge TTS request failed, fallback to local pacing:', err);
    }
  }

  // 2. FALLBACK (Mute mode or offline)
  runLocalSubtitles(displayCleanText, speechCleanText);
}

function renderSubtitlesSyncedWithAudio(displayCleanText, audioElem) {
  const chunks = chunkText(displayCleanText, 10);
  let chunkIndex = 0;
  const totalChunks = chunks.length;

  function showChunk(words, durationSec, onDone) {
    subtitlesContainer.innerHTML = '';
    subtitlesContainer.classList.remove('hidden');

    const wordElements = [];
    words.forEach((w) => {
      const span = document.createElement('span');
      span.className = 'sub-word';
      span.innerText = w;
      subtitlesContainer.appendChild(span);
      wordElements.push(span);
    });

    let activeWordIndex = -1;
    function highlightWord(index) {
      if (activeWordIndex === index) return;
      if (activeWordIndex >= 0 && wordElements[activeWordIndex]) {
        wordElements[activeWordIndex].classList.remove('active');
      }
      activeWordIndex = index;
      if (wordElements[activeWordIndex]) {
        wordElements[activeWordIndex].classList.add('active');
      }
    }

    const perWordMs = (durationSec * 1000) / words.length;
    let w = 0;
    const stepInterval = setInterval(() => {
      if (w < words.length) {
        highlightWord(w);
        w++;
      }
    }, Math.max(180, perWordMs));

    activeSubtitleTimeout = setTimeout(() => {
      clearInterval(stepInterval);
      highlightWord(words.length - 1);
      setTimeout(onDone, 600);
    }, durationSec * 1000);
  }

  // Estimate total audio duration or fallback to 3s
  const totalDuration = audioElem.duration && !isNaN(audioElem.duration) ? audioElem.duration : Math.max(2.5, displayCleanText.length / 15);
  const perChunkDuration = Math.max(1.8, totalDuration / totalChunks);

  function next() {
    if (chunkIndex < totalChunks) {
      showChunk(chunks[chunkIndex], perChunkDuration, () => {
        chunkIndex++;
        next();
      });
    } else {
      activeSubtitleTimeout = setTimeout(() => {
        subtitlesContainer.classList.add('hidden');
      }, 3500);
    }
  }

  audioElem.onended = () => {
    activeSubtitleTimeout = setTimeout(() => {
      subtitlesContainer.classList.add('hidden');
    }, 3000);
  };

  next();
}

function runLocalSubtitles(displayCleanText, speechCleanText) {
  const chunks = chunkText(displayCleanText, 10);
  let chunkIndex = 0;
  const speedMultiplier = parseFloat(config.subtitleSpeed) || 0.9;

  function renderChunk(words, onComplete) {
    subtitlesContainer.innerHTML = '';
    subtitlesContainer.classList.remove('hidden');

    const wordElements = [];
    words.forEach((w) => {
      const span = document.createElement('span');
      span.className = 'sub-word';
      span.innerText = w;
      subtitlesContainer.appendChild(span);
      wordElements.push(span);
    });

    let activeWordIndex = -1;
    function highlightWord(index) {
      if (activeWordIndex === index) return;
      if (activeWordIndex >= 0 && wordElements[activeWordIndex]) {
        wordElements[activeWordIndex].classList.remove('active');
      }
      activeWordIndex = index;
      if (wordElements[activeWordIndex]) {
        wordElements[activeWordIndex].classList.add('active');
      }
    }

    let wIdx = 0;
    function stepMute() {
      if (wIdx < words.length) {
        highlightWord(wIdx);
        const currentWordLen = words[wIdx].length;
        const duration = Math.max(280, Math.min(520, currentWordLen * 52)) / speedMultiplier;
        wIdx++;
        activeSubtitleTimeout = setTimeout(stepMute, duration);
      } else {
        activeSubtitleTimeout = setTimeout(onComplete, 2000);
      }
    }
    stepMute();
  }

  function nextChunk() {
    if (chunkIndex < chunks.length) {
      renderChunk(chunks[chunkIndex], () => {
        chunkIndex++;
        nextChunk();
      });
    } else {
      activeSubtitleTimeout = setTimeout(() => {
        subtitlesContainer.classList.add('hidden');
      }, 4000);
    }
  }

  nextChunk();
}

// ----------------------------------------------------
// CHAT HISTORY & CONTEXT WINDOW MANAGEMENT
// ----------------------------------------------------
function openHistoryModal() {
  renderHistoryView();
  historyModal.classList.add('active');
}

function closeHistoryModal() {
  historyModal.classList.remove('active');
}

function renderHistoryView() {
  historyList.innerHTML = '';
  historyCountBadge.innerText = `${conversationHistory.length} mensagens`;

  if (conversationHistory.length === 0) {
    historyList.innerHTML = `
      <div class="empty-history">
        <span>🌸 Nenhuma conversa gravada ainda.</span>
        <span>Pressione <kbd style="color:#ff80bf">[/]</kbd> para puxar assunto com a Kie-chan!</span>
      </div>
    `;
    return;
  }

  conversationHistory.forEach((msg) => {
    const msgEl = document.createElement('div');
    msgEl.className = `hist-msg ${msg.role === 'user' ? 'user' : 'waifu'}`;

    const senderName = msg.role === 'user' ? 'Você' : config.waifuName;
    // Format actions like *sorri* with <em>
    const formattedContent = escapeHtml(msg.content).replace(/\*([^*]+)\*/g, '<em>*$1*</em>');

    let attachmentHtml = '';
    if (msg.attachment) {
      if (msg.attachment.isImage && msg.attachment.dataUrl) {
        attachmentHtml = `
          <div class="hist-attachment">
            <img src="${msg.attachment.dataUrl}" class="hist-attach-img" alt="${escapeHtml(msg.attachment.name)}">
            <span class="hist-attach-name">🖼️ ${escapeHtml(msg.attachment.name)}</span>
          </div>`;
      } else {
        attachmentHtml = `
          <div class="hist-attachment">
            <span class="hist-attach-name">📎 ${escapeHtml(msg.attachment.name)}</span>
          </div>`;
      }
    }

    msgEl.innerHTML = `
      <div class="hist-sender">${senderName}</div>
      ${attachmentHtml}
      <div class="hist-bubble">${formattedContent}</div>
    `;
    historyList.appendChild(msgEl);
  });

  setTimeout(() => {
    historyList.scrollTop = historyList.scrollHeight;
  }, 50);
}

async function clearConversationHistory() {
  conversationHistory = [];
  if (window.electronAPI && window.electronAPI.clearHistory) {
    await window.electronAPI.clearHistory();
  }
  renderHistoryView();
  playSubtitles('*cruza os braços com a cara emburrada* H-hmpf! Apagou tudo?! Não é como se eu quisesse lembrar do que você falou mesmo, b-baka!');
}

function saveHistoryState() {
  if (window.electronAPI && window.electronAPI.saveHistory) {
    window.electronAPI.saveHistory(conversationHistory);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, '<br>');
}

// ----------------------------------------------------
// SLEEK COMMAND BAR (Press '/')
// ----------------------------------------------------
function openCommandBar() {
  commandBar.classList.remove('hidden');
  promptInput.focus();
}

function closeCommandBar() {
  commandBar.classList.add('hidden');
  promptInput.blur();
}

// ----------------------------------------------------
// ATTACHMENT SUPPORT (Images, Documents, Code)
// ----------------------------------------------------
function processAttachmentFile(file) {
  if (!file) return;

  // Max size limit: 12MB
  if (file.size > 12 * 1024 * 1024) {
    playSubtitles('*olha espantada* Esse arquivo é gigante demais, b-baka! Envie algo menor que 12MB!');
    return;
  }

  const isImg = file.type.startsWith('image/');
  const reader = new FileReader();

  if (isImg) {
    reader.onload = (e) => {
      currentAttachment = {
        name: file.name,
        type: file.type || 'image/png',
        size: file.size,
        dataUrl: e.target.result,
        textContent: null
      };
      showAttachmentChip('🖼️', file.name);
    };
    reader.readAsDataURL(file);
  } else {
    reader.onload = (e) => {
      currentAttachment = {
        name: file.name,
        type: file.type || 'text/plain',
        size: file.size,
        dataUrl: null,
        textContent: typeof e.target.result === 'string' ? e.target.result : ''
      };
      showAttachmentChip('📄', file.name);
    };
    reader.readAsText(file);
  }
}

function showAttachmentChip(icon, name) {
  if (attachmentIcon) attachmentIcon.innerText = icon;
  if (attachmentName) attachmentName.innerText = name;
  if (attachmentPreview) attachmentPreview.classList.remove('hidden');
}

function clearAttachment() {
  currentAttachment = null;
  if (fileInput) fileInput.value = '';
  if (attachmentPreview) attachmentPreview.classList.add('hidden');
}

// ----------------------------------------------------
// TASKS & ANTI-PROCRASTINATION SYSTEM
// ----------------------------------------------------
const SCOLD_TEMPLATES = [
  (d, t, dl) => `*bate o pé furiosa* Ei, idiota! O que você tá fazendo no ${d} em vez de terminar "${t}"?! ${dl ? 'O prazo é ' + dl + '! ' : ''}Volta pro trabalho agora, b-baka!`,
  (d, t, dl) => `*olha com a cara emburrada e rosto vermelho* H-hmpf! No ${d} de novo?! Você tem a tarefa "${t}" pendente, seu procrastinador bobo! Vai terminar logo!`,
  (d, t, dl) => `*cruza os braços batendo o pé* N-não pense que eu não tô vendo você no ${d}! Se você não fizer "${t}", eu vou ficar muito brava com você, b-baka!`,
  (d, t, dl) => `*aponta o dedo envergonhada* E-ei! Quem disse que você podia ficar enrolando no ${d}?! Vai cuidar de "${t}" logo! Não é como se eu me importasse com você nem nada...`
];

function handleProcrastinationAlert(data) {
  if (config.antiProcrastination === false) return;
  const { distraction, taskTitle, taskDeadline } = data;
  let formattedDeadline = '';
  if (taskDeadline) {
    const parts = taskDeadline.split('-');
    if (parts.length === 3) formattedDeadline = `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const randomScold = SCOLD_TEMPLATES[Math.floor(Math.random() * SCOLD_TEMPLATES.length)];
  const scoldLine = randomScold(distraction || 'navegador', taskTitle || 'sua tarefa', formattedDeadline);
  playSubtitles(scoldLine);
}

function openTasksModal() {
  renderTasksView();
  tasksModal.classList.add('active');
  if (newTaskDeadline && !newTaskDeadline.value) {
    const today = new Date().toISOString().split('T')[0];
    newTaskDeadline.value = today;
  }
}

function closeTasksModal() {
  tasksModal.classList.remove('active');
}

function updateTasksBadge() {
  const pendingCount = tasksList.filter(t => !t.completed).length;
  if (tasksCountBadge) {
    tasksCountBadge.innerText = `${pendingCount} pendente${pendingCount === 1 ? '' : 's'}`;
  }
}

function renderTasksView() {
  tasksListEl.innerHTML = '';
  updateTasksBadge();

  if (toggleAntiProc) {
    toggleAntiProc.checked = config.antiProcrastination !== false;
  }

  if (tasksList.length === 0) {
    tasksListEl.innerHTML = `
      <div class="empty-tasks">
        <span>🎉 Nenhuma tarefa pendente!</span>
        <span>Adicione suas tarefas acima para a Kie-chan te ajudar a não procrastinar.</span>
      </div>
    `;
    return;
  }

  const todayStr = new Date().toISOString().split('T')[0];

  tasksList.forEach(task => {
    const taskItem = document.createElement('div');
    taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;

    let deadlineBadgeHtml = '';
    if (task.deadline) {
      const parts = task.deadline.split('-');
      const formattedDate = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : task.deadline;
      if (task.completed) {
        deadlineBadgeHtml = `<span class="deadline-badge">Concluída</span>`;
      } else if (task.deadline < todayStr) {
        deadlineBadgeHtml = `<span class="deadline-badge overdue">⚠️ Atrasada! (${formattedDate})</span>`;
      } else if (task.deadline === todayStr) {
        deadlineBadgeHtml = `<span class="deadline-badge today">⏰ Prazo: Hoje!</span>`;
      } else {
        deadlineBadgeHtml = `<span class="deadline-badge future">📅 Prazo: ${formattedDate}</span>`;
      }
    }

    taskItem.innerHTML = `
      <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''} data-id="${task.id}" title="Marcar como concluída">
      <div class="task-info">
        <span class="task-title">${escapeHtml(task.title)}</span>
        ${deadlineBadgeHtml}
      </div>
      <button class="task-del-btn" data-id="${task.id}" title="Excluir tarefa">🗑️</button>
    `;

    tasksListEl.appendChild(taskItem);
  });

  tasksListEl.querySelectorAll('.task-check').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      toggleTaskComplete(id);
    });
  });

  tasksListEl.querySelectorAll('.task-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.id;
      deleteTask(id);
    });
  });
}

async function addNewTask() {
  const title = (newTaskTitle.value || '').trim();
  const deadline = newTaskDeadline.value || '';

  if (!title) {
    newTaskTitle.focus();
    return;
  }

  const newTask = {
    id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    title: title,
    deadline: deadline,
    completed: false,
    createdAt: Date.now()
  };

  tasksList.unshift(newTask);
  newTaskTitle.value = '';

  if (window.electronAPI && window.electronAPI.saveTasks) {
    await window.electronAPI.saveTasks(tasksList);
  }

  renderTasksView();
  playSubtitles(`*olha de lado com bico* Anotei "${title}"! É bom você fazer mesmo, seu baka!`);
}

async function toggleTaskComplete(id) {
  const task = tasksList.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;

  if (window.electronAPI && window.electronAPI.saveTasks) {
    await window.electronAPI.saveTasks(tasksList);
  }

  renderTasksView();

  if (task.completed) {
    const praiseLines = [
      `*desvia o olhar corada* P-parabéns... Você finalmente terminou "${task.title}". N-não que eu estivesse torcendo por você nem nada, seu bobo!`,
      `*cruza os braços com vergonha* H-hmpf! Até que enfim você terminou! Bom trabalho... m-mas não se acostume com meus elogios, b-baka!`,
      `*olha para o lado com bochechas vermelhas* Menos uma tarefa! Você se esforçou hoje... N-não me faça falar mais que isso, tá?!`
    ];
    const praise = praiseLines[Math.floor(Math.random() * praiseLines.length)];
    playSubtitles(praise);
  }
}

async function deleteTask(id) {
  tasksList = tasksList.filter(t => t.id !== id);
  if (window.electronAPI && window.electronAPI.saveTasks) {
    await window.electronAPI.saveTasks(tasksList);
  }
  renderTasksView();
}

// ----------------------------------------------------
// 3D LOOK AT MOUSE TRACKING
// ----------------------------------------------------
function setupCursorTracking() {
  window.addEventListener('mousemove', (e) => {
    if (!lookAtMouseEnabled) return;
    const nx = (e.clientX / (window.innerWidth || 510)) * 2 - 1;
    const ny = (e.clientY / (window.innerHeight || 720)) * 2 - 1;
    targetHeadLook.x = -nx * 0.45;
    targetHeadLook.y = ny * 0.25;
  });

  setInterval(async () => {
    if (!lookAtMouseEnabled || !window.electronAPI || !window.electronAPI.getCursorPos) return;
    try {
      const pos = await window.electronAPI.getCursorPos();
      if (!pos || !isFinite(pos.cursorX) || !isFinite(pos.cursorY)) return;

      const winW = pos.winW || window.innerWidth || 510;
      const winH = pos.winH || window.innerHeight || 720;
      const centerX = pos.winX + (winW / 2);
      const centerY = pos.winY + (winH * 0.35);
      const dx = (pos.cursorX - centerX) / (winW * 1.1);
      const dy = (pos.cursorY - centerY) / (winH * 1.1);

      if (isFinite(dx) && isFinite(dy)) {
        targetHeadLook.x = -dx * 0.45;
        targetHeadLook.y = dy * 0.25;
      }
    } catch (e) {}
  }, 75);
}

function toggleLookAtMouse() {
  lookAtMouseEnabled = !lookAtMouseEnabled;
  config.lookAtMouse = lookAtMouseEnabled;
  if (btnLookMouse) {
    btnLookMouse.classList.toggle('active', lookAtMouseEnabled);
  }
  if (cfgLookMouse) {
    cfgLookMouse.checked = lookAtMouseEnabled;
  }
  if (window.electronAPI) {
    window.electronAPI.saveConfig(config);
  }
  if (lookAtMouseEnabled) {
    playSubtitles('*olha nos seus olhos* Agora eu tô de olho em você e no seu mouse, viu?!');
  } else {
    targetHeadLook = { x: 0, y: 0 };
    playSubtitles('*desvia o olhar* H-hmpf! Não preciso ficar olhando pra onde você aponta mesmo!');
  }
}

function toggleMute() {
  config.isMuted = !config.isMuted;
  if (config.isMuted) {
    if (currentAudio) {
      try { currentAudio.pause(); } catch (e) {}
      currentAudio = null;
    }
    window.speechSynthesis.cancel();
  }
  updateMuteUI();
  if (window.electronAPI) {
    window.electronAPI.saveConfig(config);
  }
}

function updateMuteUI() {
  if (config.isMuted) {
    btnMute.innerText = '🔇';
    btnMute.classList.add('muted');
    btnMute.title = 'Modo Mudo ATIVADO (Clique ou pressione M para desativar)';
  } else {
    btnMute.innerText = '🔊';
    btnMute.classList.remove('muted');
    btnMute.title = 'Modo Mudo DESATIVADO (Clique ou pressione M para silenciar)';
  }
  if (cfgMuteToggle) cfgMuteToggle.checked = config.isMuted;
}

// ----------------------------------------------------
// AUDIO RECORDING & SPEECH RECOGNITION
// ----------------------------------------------------
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    speechRecognizer = new SpeechRecognition();
    speechRecognizer.continuous = true;
    speechRecognizer.interimResults = true;
    speechRecognizer.lang = 'pt-BR';

    speechRecognizer.onresult = (event) => {
      interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      const liveText = (finalTranscript + ' ' + interimTranscript).trim();
      promptInput.value = liveText;
    };
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    finalTranscript = '';
    interimTranscript = '';
    isRecording = true;

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      handleFinishedRecording();
    };

    mediaRecorder.start();
    recordingStartTime = Date.now();
    recordingPill.classList.add('active');
    btnMicTop.classList.add('active');
    btnPromptMic.classList.add('recording');

    if (speechRecognizer && config.sttProvider === 'webspeech') {
      try { speechRecognizer.start(); } catch (err) {}
    }

    recordingTimerInterval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const secs = String(elapsed % 60).padStart(2, '0');
      recordingTimer.innerText = `${mins}:${secs}`;
    }, 500);

  } catch (err) {
    console.error('Mic access error:', err);
    alert('Não foi possível acessar o microfone. Verifique as permissões de áudio no Windows!');
  }
}

function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }

  if (speechRecognizer) {
    try { speechRecognizer.stop(); } catch (e) {}
  }

  clearInterval(recordingTimerInterval);
  recordingPill.classList.remove('active');
  btnMicTop.classList.remove('active');
  btnPromptMic.classList.remove('recording');
}

async function handleFinishedRecording() {
  const transcribedText = (finalTranscript + ' ' + interimTranscript).trim() || promptInput.value.trim();

  if (config.sttProvider === 'custom_api' && config.sttUrl && audioChunks.length > 0) {
    thinkingText.innerText = 'Transcrevendo áudio...';
    thinkingIndicator.classList.add('active');
    try {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', audioBlob, 'audio.webm');
      formData.append('model', 'whisper-1');

      const res = await fetch(config.sttUrl, {
        method: 'POST',
        headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {},
        body: formData
      });
      const data = await res.json();
      const customText = data.text || data.transcription || '';
      thinkingIndicator.classList.remove('active');
      if (customText) {
        sendPrompt(customText);
        return;
      }
    } catch (e) {
      console.error('Custom STT error:', e);
      thinkingIndicator.classList.remove('active');
    }
  }

  if (transcribedText) {
    sendPrompt(transcribedText);
    promptInput.value = '';
  }
}

// ----------------------------------------------------
// CHAT & DEEPSEEK KIE.AI INTEGRATION (POST /openai/v1/responses)
// ----------------------------------------------------
async function sendPrompt(userText) {
  if (!userText || isThinking) return;

  const attachedToSend = currentAttachment;
  clearAttachment();
  closeCommandBar();

  let finalUserText = userText;
  if (attachedToSend && attachedToSend.textContent) {
    finalUserText = `${userText}\n\n[Arquivo Anexo: ${attachedToSend.name}]\n\`\`\`\n${attachedToSend.textContent.slice(0, 15000)}\n\`\`\``;
  }

  // Save to Context Memory
  conversationHistory.push({
    role: 'user',
    content: finalUserText,
    attachment: attachedToSend ? {
      name: attachedToSend.name,
      type: attachedToSend.type,
      isImage: attachedToSend.type.startsWith('image/'),
      dataUrl: attachedToSend.dataUrl,
      size: attachedToSend.size
    } : null
  });
  saveHistoryState();

  if (!config.apiKey) {
    playSubtitles(`*olha nos olhos* Mestre, você precisa colocar sua API Key do Kie.ai nas configurações (⚙️) para eu responder!`);
    openSettingsModal();
    return;
  }

  isThinking = true;
  thinkingText.innerText = `${config.waifuName} pensando...`;
  thinkingIndicator.classList.add('active');

  try {
    let res;
    if (window.electronAPI && window.electronAPI.callChatApi) {
      res = await window.electronAPI.callChatApi({
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        endpointPath: config.endpointPath || '/openai/v1/responses',
        model: config.model || 'deepseek-v4-1-flash',
        messages: conversationHistory,
        systemPrompt: config.systemPrompt,
        attachment: attachedToSend
      });
    } else {
      let cleanBaseUrl = (config.baseUrl || 'https://api.kie.ai').replace(/\/+$/, '');
      let fullUrl = cleanBaseUrl.endsWith('/responses') ? cleanBaseUrl : cleanBaseUrl + '/openai/v1/responses';

      const payloadItems = [];
      if (config.systemPrompt) {
        payloadItems.push({ role: 'system', content: config.systemPrompt });
      }
      payloadItems.push(...conversationHistory.slice(-20));

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: config.model || 'deepseek-v4-1-flash',
          input: payloadItems,
          messages: payloadItems,
          temperature: 0.75
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
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
      res = { success: true, reply: reply || 'Sem resposta.' };
    }

    if (res.success) {
      const reply = res.reply;
      conversationHistory.push({ role: 'assistant', content: reply });
      saveHistoryState();
      playSubtitles(reply);
    } else {
      const err = res.error || 'Erro na API';
      playSubtitles(`*bate o pé* Deu erro na API! ${err.slice(0, 70)}...`);
    }
  } catch (err) {
    console.error('Chat error:', err);
    playSubtitles(`*cruza os braços* Não consegui falar com a API do Kie.ai, baka!`);
  } finally {
    isThinking = false;
    thinkingIndicator.classList.remove('active');
  }
}

// ----------------------------------------------------
// UI EVENT LISTENERS & HOTKEYS
// ----------------------------------------------------
function setupEventListeners() {
  // Hotkeys: '/' to chat, 'H' for history, 'M' to mute, 'T' for tasks, 'O' for look at mouse
  window.addEventListener('keydown', (e) => {
    const isEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);

    if (e.key === '/' && !isEditing && !settingsModal.classList.contains('active') && !historyModal.classList.contains('active') && !tasksModal.classList.contains('active')) {
      e.preventDefault();
      openCommandBar();
      return;
    }

    if ((e.key === 'h' || e.key === 'H') && !isEditing) {
      e.preventDefault();
      if (historyModal.classList.contains('active')) closeHistoryModal();
      else openHistoryModal();
      return;
    }

    if ((e.key === 't' || e.key === 'T') && !isEditing) {
      e.preventDefault();
      if (tasksModal.classList.contains('active')) closeTasksModal();
      else openTasksModal();
      return;
    }

    if ((e.key === 'o' || e.key === 'O') && !isEditing) {
      e.preventDefault();
      toggleLookAtMouse();
      return;
    }

    if ((e.key === 's' || e.key === 'S') && !isEditing) {
      e.preventDefault();
      if (settingsModal.classList.contains('active')) closeSettingsModal();
      else openSettingsModal();
      return;
    }

    if ((e.key === 'm' || e.key === 'M') && !isEditing) {
      e.preventDefault();
      toggleMute();
      return;
    }

    if (e.key === 'Escape') {
      if (!commandBar.classList.contains('hidden')) {
        closeCommandBar();
      } else if (tasksModal.classList.contains('active')) {
        closeTasksModal();
      } else if (historyModal.classList.contains('active')) {
        closeHistoryModal();
      } else if (settingsModal.classList.contains('active')) {
        closeSettingsModal();
      }
    }
  });

  // Clicking on canvas / character: opens command bar
  canvasContainer.addEventListener('click', () => {
    if (commandBar.classList.contains('hidden') && !historyModal.classList.contains('active') && !settingsModal.classList.contains('active') && !tasksModal.classList.contains('active')) {
      openCommandBar();
    }
  });

  // Command bar send
  btnPromptSend.addEventListener('click', () => {
    const text = promptInput.value.trim();
    if (text || currentAttachment) {
      sendPrompt(text || (currentAttachment ? `Analise o anexo: ${currentAttachment.name}` : ''));
    }
  });

  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnPromptSend.click();
    }
  });

  // Attachment button & file input
  if (btnAttach && fileInput) {
    btnAttach.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        processAttachmentFile(e.target.files[0]);
      }
    });
  }

  if (btnRemoveAttachment) {
    btnRemoveAttachment.addEventListener('click', clearAttachment);
  }

  // Drag and drop attachment support
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      openCommandBar();
      processAttachmentFile(e.dataTransfer.files[0]);
    }
  });

  // Clipboard paste attachment support (Ctrl+V)
  window.addEventListener('paste', (e) => {
    if (e.clipboardData && e.clipboardData.items) {
      for (const item of e.clipboardData.items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            openCommandBar();
            processAttachmentFile(file);
            break;
          }
        }
      }
    }
  });

  // Look at mouse button
  if (btnLookMouse) {
    btnLookMouse.addEventListener('click', toggleLookAtMouse);
  }

  // Tasks & Anti-Procrastination buttons & events
  if (btnTasks) btnTasks.addEventListener('click', openTasksModal);
  if (btnCloseTasks) btnCloseTasks.addEventListener('click', closeTasksModal);
  if (btnDismissTasks) btnDismissTasks.addEventListener('click', closeTasksModal);

  if (toggleAntiProc) {
    toggleAntiProc.addEventListener('change', (e) => {
      config.antiProcrastination = e.target.checked;
      if (cfgAntiProc) cfgAntiProc.checked = config.antiProcrastination;
      if (window.electronAPI) window.electronAPI.saveConfig(config);
      if (config.antiProcrastination) {
        playSubtitles('*olha séria* Ativado! Agora vou ficar de olho se você tentar procrastinar!');
      } else {
        playSubtitles('*suspira* Desativou a cobrança? Vê se não vai ficar o dia todo vendo besteira!');
      }
    });
  }

  if (btnAddTask) {
    btnAddTask.addEventListener('click', addNewTask);
  }

  if (newTaskTitle) {
    newTaskTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addNewTask();
      }
    });
  }

  // History buttons
  btnHistory.addEventListener('click', openHistoryModal);
  btnCmdHistory.addEventListener('click', () => {
    closeCommandBar();
    openHistoryModal();
  });
  if (btnCmdSettings) {
    btnCmdSettings.addEventListener('click', () => {
      closeCommandBar();
      openSettingsModal();
    });
  }
  btnCloseHistory.addEventListener('click', closeHistoryModal);
  btnDismissHistory.addEventListener('click', closeHistoryModal);
  btnClearHistory.addEventListener('click', clearConversationHistory);

  // Mute button
  btnMute.addEventListener('click', toggleMute);

  // Mic buttons
  btnMicTop.addEventListener('click', () => {
    if (isRecording) stopRecording();
    else startRecording();
  });
  btnPromptMic.addEventListener('click', () => {
    if (isRecording) stopRecording();
    else startRecording();
  });
  btnStopRecordingPill.addEventListener('click', stopRecording);

  // Pin / Always On Top
  btnPin.addEventListener('click', async () => {
    config.alwaysOnTop = !config.alwaysOnTop;
    if (window.electronAPI) {
      await window.electronAPI.toggleAlwaysOnTop(config.alwaysOnTop);
      window.electronAPI.saveConfig(config);
    }
    btnPin.classList.toggle('active', config.alwaysOnTop);
  });

  // Zoom / Scale
  btnZoomIn.addEventListener('click', () => applyScale(currentScale + 0.15));
  btnZoomOut.addEventListener('click', () => applyScale(currentScale - 0.15));

  // Reset Camera
  btnResetCam.addEventListener('click', () => {
    camera.position.set(initialCameraPos.x, initialCameraPos.y, initialCameraPos.z);
    controls.target.set(0, 0.75, 0);
    applyScale(1.0);
    controls.update();
  });

  // Canvas Mouse Wheel Scale
  canvasContainer.addEventListener('wheel', (e) => {
    if (e.ctrlKey || e.shiftKey) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    applyScale(currentScale + delta);
  });

  // Window drag via Alt + Left Click or Middle Click anywhere
  let isWindowDragging = false;
  window.addEventListener('mousedown', (e) => {
    if (e.altKey || (e.button === 1 && !e.target.closest('.command-box, .modal-card, .history-card'))) {
      isWindowDragging = true;
      if (window.electronAPI && window.electronAPI.windowDragStart) {
        window.electronAPI.windowDragStart();
      }
    }
  });

  window.addEventListener('mousemove', () => {
    if (isWindowDragging && window.electronAPI && window.electronAPI.windowDragMove) {
      window.electronAPI.windowDragMove();
    }
  });

  window.addEventListener('mouseup', () => {
    if (isWindowDragging) {
      isWindowDragging = false;
      if (window.electronAPI && window.electronAPI.windowDragEnd) {
        window.electronAPI.windowDragEnd();
      }
    }
  });

  // Window Controls
  btnMinimize.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.windowMinimize();
  });
  btnClose.addEventListener('click', () => {
    if (window.electronAPI) window.electronAPI.windowClose();
  });

  // Settings Modal Handlers
  btnSettings.addEventListener('click', openSettingsModal);
  btnCloseSettings.addEventListener('click', closeSettingsModal);
  btnCancelSettings.addEventListener('click', closeSettingsModal);
  btnSaveSettings.addEventListener('click', saveSettings);

  // Settings Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = document.getElementById(btn.dataset.tab);
      if (targetTab) targetTab.classList.add('active');
    });
  });

  // Sliders in Settings
  cfgModelScale.addEventListener('input', (e) => {
    scaleVal.innerText = parseFloat(e.target.value).toFixed(1);
    applyScale(parseFloat(e.target.value));
  });
  cfgSubSpeed.addEventListener('input', (e) => {
    const v = parseFloat(e.target.value);
    subSpeedVal.innerText = v <= 0.8 ? 'Mais Lenta (Confortável)' : v >= 1.2 ? 'Rápida' : 'Normal';
  });
  if (cfgEdgePitch) {
    cfgEdgePitch.addEventListener('change', (e) => {
      if (edgePitchVal) edgePitchVal.innerText = `${e.target.value} (Fofa)`;
    });
  }
  cfgSttProvider.addEventListener('change', (e) => {
    groupCustomStt.style.display = e.target.value === 'custom_api' ? 'flex' : 'none';
  });
}

function updateUIFromConfig() {
  document.getElementById('header-waifu-name').innerText = config.waifuName;
  btnPin.classList.toggle('active', config.alwaysOnTop !== false);
  if (btnLookMouse) btnLookMouse.classList.toggle('active', config.lookAtMouse !== false);
  updateMuteUI();
}

function openSettingsModal() {
  cfgApiKey.value = config.apiKey || '';
  cfgBaseUrl.value = config.baseUrl || 'https://api.kie.ai';
  cfgEndpointPath.value = config.endpointPath || '/openai/v1/responses';
  cfgModel.value = config.model || 'deepseek-v4-1-flash';
  cfgWaifuName.value = config.waifuName || 'Kie-chan';
  cfgSystemPrompt.value = config.systemPrompt || DEFAULT_TSUNDERE_PROMPT;
  cfgModelScale.value = currentScale;
  scaleVal.innerText = currentScale.toFixed(1);
  cfgMuteToggle.checked = !!config.isMuted;
  cfgSubSpeed.value = config.subtitleSpeed || 0.9;
  const v = parseFloat(cfgSubSpeed.value);
  subSpeedVal.innerText = v <= 0.8 ? 'Mais Lenta (Confortável)' : v >= 1.2 ? 'Rápida' : 'Normal';
  if (cfgEdgeVoice) cfgEdgeVoice.value = config.edgeVoice || 'pt-BR-FranciscaNeural';
  if (cfgEdgePitch) {
    cfgEdgePitch.value = config.edgePitch || '+18Hz';
    if (edgePitchVal) edgePitchVal.innerText = `${config.edgePitch || '+18Hz'} (Fofa)`;
  }
  cfgSttProvider.value = config.sttProvider || 'webspeech';
  groupCustomStt.style.display = cfgSttProvider.value === 'custom_api' ? 'flex' : 'none';
  cfgSttUrl.value = config.sttUrl || '';
  if (cfgLookMouse) cfgLookMouse.checked = config.lookAtMouse !== false;
  if (cfgAntiProc) cfgAntiProc.checked = config.antiProcrastination !== false;

  settingsModal.classList.add('active');
}

function closeSettingsModal() {
  settingsModal.classList.remove('active');
}

async function saveSettings() {
  config.apiKey = cfgApiKey.value.trim();
  config.baseUrl = cfgBaseUrl.value.trim() || 'https://api.kie.ai';
  config.endpointPath = cfgEndpointPath.value.trim() || '/openai/v1/responses';
  config.model = cfgModel.value.trim() || 'deepseek-v4-1-flash';
  config.waifuName = cfgWaifuName.value.trim() || 'Kie-chan';
  config.systemPrompt = cfgSystemPrompt.value.trim() || DEFAULT_TSUNDERE_PROMPT;
  config.scale = parseFloat(cfgModelScale.value) || 1.0;
  config.isMuted = cfgMuteToggle.checked;
  config.subtitleSpeed = parseFloat(cfgSubSpeed.value) || 0.9;
  if (cfgEdgeVoice) config.edgeVoice = cfgEdgeVoice.value;
  if (cfgEdgePitch) config.edgePitch = cfgEdgePitch.value;
  config.sttProvider = cfgSttProvider.value;
  config.sttUrl = cfgSttUrl.value.trim();
  if (cfgLookMouse) {
    config.lookAtMouse = cfgLookMouse.checked;
    lookAtMouseEnabled = config.lookAtMouse;
  }
  if (cfgAntiProc) {
    config.antiProcrastination = cfgAntiProc.checked;
    if (toggleAntiProc) toggleAntiProc.checked = config.antiProcrastination;
  }

  if (window.electronAPI) {
    await window.electronAPI.saveConfig(config);
  }

  updateUIFromConfig();
  applyScale(config.scale);
  closeSettingsModal();

  playSubtitles('*olha pro lado* Pronto, salvei! Não ache que eu fiz isso pra te agradar, b-baka!');
}

// Start app
window.addEventListener('DOMContentLoaded', init);
