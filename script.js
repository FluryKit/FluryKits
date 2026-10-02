// ==========================================
// Canvas & Context Setup
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

ctx.imageSmoothingEnabled = false;

// UI DOM Elements
const roomTitleEl = document.getElementById('roomTitle');
const promptEl = document.getElementById('interactionPrompt');
const modalEl = document.getElementById('infoModal');
const modalTitleEl = document.getElementById('modalTitle');
const modalBodyEl = document.getElementById('modalBody');

// ==========================================
// Assets Setup
// ==========================================
const mapImage = new Image();
mapImage.src = 'Assets/Room.png'; // 192x96 px PNG

const playerImage = new Image();
playerImage.src = 'Assets/YCH.png'; // 32x32 px PNG

// ==========================================
// Game State & World Constants
// ==========================================
const ROOM_SIZE = 96;
let currentRoom = 1;

const player = {
  x: 32,
  y: 32,
  width: 32,
  height: 32,
  speed: 1,
  targetX: null,
  targetY: null
};

// Cooldown flag to stop infinite door glitching
let isTeleporting = false;

// ==========================================
// Interactive Objects & Doorways Config
// ==========================================
const roomObjects = {
  1: [ // Kovy's Room (Global X: 0 - 96 px)
    {
      id: 'about_desk',
      name: "Kovy's Desk",
      x: 16, y: 16, width: 32, height: 32,
      title: "About Me",
      content: `
        <p>Hi there! Welcome to my cozy corner of the web!</p>
        <p>I'm <strong>Vivian (FluryKit / Kovy)</strong> — digital illustrator, character designer, and developer.</p>
        <p>Explore around or check out my commission room!</p>
      `
    },
    {
      id: 'door_to_comm',
      name: "Doorway to Commission Room",
      x: 16,        // Global X: 16 to 47
      y: 60,
      width: 31,
      height: 32,
      isDoor: true,
      targetRoom: 2,
      targetX: 48,  // Spawns above Room 2's door (X: 48)
      targetY: 28   // Spawns safely above the doorway
    }
  ],
  2: [ // Commission Room (Global X: 96 - 192 px)
    {
      id: 'comm_desk',
      name: "Commission Desk",
      x: 16, y: 16, width: 32, height: 32,
      title: "Commission Info & Status",
      content: `
        <p><strong>Status:</strong> OPEN ✨</p>
        <p>I offer chibis, character sheets, pixel art, and digital illustrations.</p>
      `
    },
    {
      id: 'door_to_kovy',
      name: "Doorway to Kovy's Room",
      x: 48,        // Global X 144 - 96 = 48 px (X: 144 to 175)
      y: 60,
      width: 31,    // Width: 175 - 144 = 31 px
      height: 32,
      isDoor: true,
      targetRoom: 1,
      targetX: 16,  // Spawns above Room 1's door (X: 16)
      targetY: 28   // Spawns safely above the doorway
    }
  ]
};

// Input State
const keys = {};
let activeInteractable = null;

// ==========================================
// Input Event Listeners
// ==========================================
window.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;

  if ((e.key.toLowerCase() === 'e' || e.key === ' ') && activeInteractable) {
    triggerInteraction(activeInteractable);
  }
});

window.addEventListener('keyup', (e) => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scale = ROOM_SIZE / rect.width;
  const clickX = (e.clientX - rect.left) * scale;
  const clickY = (e.clientY - rect.top) * scale;

  const objects = roomObjects[currentRoom] || [];
  const clickedObj = objects.find(obj => 
    clickX >= obj.x && clickX <= obj.x + obj.width &&
    clickY >= obj.y && clickY <= obj.y + obj.height
  );

  if (clickedObj) {
    if (isNearPlayer(clickedObj)) {
      triggerInteraction(clickedObj);
    } else {
      player.targetX = clickedObj.x + clickedObj.width / 2 - player.width / 2;
      player.targetY = clickedObj.y + clickedObj.height / 2 - player.height / 2;
    }
  } else {
    player.targetX = clickX - player.width / 2;
    player.targetY = clickY - player.height / 2;
  }
});

// ==========================================
// Main Game Loop & Logic
// ==========================================
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

function update() {
  let dx = 0;
  let dy = 0;

  if (keys['w'] || keys['arrowup']) dy -= player.speed;
  if (keys['s'] || keys['arrowdown']) dy += player.speed;
  if (keys['a'] || keys['arrowleft']) dx -= player.speed;
  if (keys['d'] || keys['arrowright']) dx += player.speed;

  if (dx !== 0 || dy !== 0) {
    player.targetX = null;
    player.targetY = null;
  } else if (player.targetX !== null && player.targetY !== null) {
    const diffX = player.targetX - player.x;
    const diffY = player.targetY - player.y;
    const distance = Math.hypot(diffX, diffY);

    if (distance > 2) {
      dx = (diffX / distance) * player.speed;
      dy = (diffY / distance) * player.speed;
    } else {
      player.targetX = null;
      player.targetY = null;
    }
  }

  const newX = Math.max(0, Math.min(ROOM_SIZE - player.width, player.x + dx));
  const newY = Math.max(0, Math.min(ROOM_SIZE - player.height, player.y + dy));

  player.x = newX;
  player.y = newY;

  checkInteractions();
}

function checkInteractions() {
  const objects = roomObjects[currentRoom] || [];
  activeInteractable = null;

  for (const obj of objects) {
    if (isNearPlayer(obj)) {
      activeInteractable = obj;
      
      // Auto-teleport if touching doorway AND not in cooldown
      if (obj.isDoor && !isTeleporting) {
        teleportToRoom(obj.targetRoom, obj.targetX, obj.targetY);
        return;
      }
      break;
    }
  }

  if (activeInteractable && !activeInteractable.isDoor) {
    promptEl.classList.remove('hidden');
    promptEl.textContent = `Press [E] or Tap for ${activeInteractable.name}`;
  } else {
    promptEl.classList.add('hidden');
  }
}

function isNearPlayer(obj) {
  const pCenterX = player.x + player.width / 2;
  const pCenterY = player.y + player.height / 2;
  const oCenterX = obj.x + obj.width / 2;
  const oCenterY = obj.y + obj.height / 2;

  const distance = Math.hypot(pCenterX - oCenterX, pCenterY - oCenterY);
  return distance < 20;
}

function triggerInteraction(obj) {
  if (obj.title && obj.content) {
    modalTitleEl.textContent = obj.title;
    modalBodyEl.innerHTML = obj.content;
    modalEl.classList.remove('hidden');
  }
}

function closeModal() {
  modalEl.classList.add('hidden');
}

// Teleport with 600ms cooldown to prevent glitch loops
function teleportToRoom(roomNum, newX = 32, newY = 32) {
  isTeleporting = true;
  currentRoom = roomNum;
  player.x = newX;
  player.y = newY;
  player.targetX = null;
  player.targetY = null;

  if (roomTitleEl) {
    roomTitleEl.textContent = roomNum === 1 ? "Kovy's Room" : "Commission Room";
  }

  promptEl.classList.add('hidden');

  setTimeout(() => {
    isTeleporting = false;
  }, 600);
}

// ==========================================
// Rendering Engine
// ==========================================
function render() {
  ctx.clearRect(0, 0, ROOM_SIZE, ROOM_SIZE);

  const sourceX = (currentRoom - 1) * ROOM_SIZE;
  
  if (mapImage.complete && mapImage.naturalWidth !== 0) {
    ctx.drawImage(
      mapImage,
      sourceX, 0, ROOM_SIZE, ROOM_SIZE,
      0, 0, ROOM_SIZE, ROOM_SIZE
    );
  } else {
    ctx.fillStyle = currentRoom === 1 ? '#2a2a3c' : '#3c2a30';
    ctx.fillRect(0, 0, ROOM_SIZE, ROOM_SIZE);
  }

  if (playerImage.complete && playerImage.naturalWidth !== 0) {
    ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = '#f38ba8';
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }
}

requestAnimationFrame(gameLoop);