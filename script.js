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
const pageIndicatorEl = document.getElementById('pageIndicator');
const prevBtnEl = document.getElementById('prevPageBtn');
const nextBtnEl = document.getElementById('nextPageBtn');

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

let isTeleporting = false;
let indicatorFrame = 0;

// Book Pagination State
let currentPages = [];
let currentPageIndex = 0;

// Touch Swipe State
let touchStartX = 0;
let touchEndX = 0;

// ==========================================
// Interactive Objects Config with Book Pages
// ==========================================
const roomObjects = {
  1: [ // Kovy's Room
    {
      id: 'about_desk',
      name: "Kovy's Desk",
      x: 29, y: 30, width: 32, height: 32,
      showArrow: true,
      title: "About Me",
      pages: [
        `
          <p>Hellow there! :D Welcome to my cozy corner of the web! I'm <strong>Kovy! 
          but you can also call me Kit or Flury</strong>.</p>
          <!--
          <div class="badge-group">
            <span class="badge-item"><i class="fa-solid fa-paintbrush"></i> -</span>
            <span class="badge-item"><i class="fa-solid fa-code"></i> -</span>
            <span class="badge-item"><i class="fa-solid fa-gamepad"></i> -</span>
          </div>
          -->
        `,
        `
          <p><strong>What I Do:</strong></p>
          <!--
          <p>I specialize in soft cozy illustrations, pixel art animations, adoptables, and interactive web applications!</p>
          <p>Feel free to explore or check out my commission desk in the next room.</p>
          -->
        `,
        `
          <!--
          <p><strong>Find Me Online:</strong></p>
          <p>You can find my art and projects across these platforms:</p>
          <div class="badge-group">
            <span class="badge-item"><i class="fa-solid fa-gem"></i> VGen</span>
            <span class="badge-item"><i class="fa-solid fa-mug-hot"></i> Ko-fi</span>
            <span class="badge-item"><i class="fa-solid fa-box"></i> Toyhouse</span>
          </div>
          -->
        `
      ]
    },
    {
      id: 'door_to_comm',
      name: "Doorway to Commission Room",
      x: 16, y: 80, width: 31, height: 32,
      isDoor: true, targetRoom: 2, targetX: 48, targetY: 28
    }
  ],
  2: [ // Commission Room
    {
      id: 'comm_desk',
      name: "Commission Desk",
      x: 16, y: 16, width: 32, height: 32,
      showArrow: true,
      title: "Commissions",
      pages: [
        `
          <p><strong>Status:</strong> TBA</p>
          <p>TBA</p>
        `,
        `
          <p><strong>Terms of Service:</strong></p>
          <p>TBA</p>
        `
      ]
    },
    {
      id: 'door_to_kovy',
      name: "Doorway to Kovy's Room",
      x: 48, y: 80, width: 31, height: 32,
      isDoor: true, targetRoom: 1, targetX: 16, targetY: 28
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
  
  const clickedObj = objects.find(obj => {
    const inObjectBounds = clickX >= obj.x && clickX <= obj.x + obj.width &&
                           clickY >= obj.y && clickY <= obj.y + obj.height;
    
    const inArrowBounds = clickX >= obj.x && clickX <= obj.x + obj.width &&
                          clickY >= obj.y - 12 && clickY <= obj.y;

    return inObjectBounds || inArrowBounds;
  });

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

// Touch Swipe Handling for Modal Book
const bookContainer = document.getElementById('bookContainer');
if (bookContainer) {
  bookContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, false);

  bookContainer.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, false);
}

function handleSwipe() {
  const swipeThreshold = 40;
  if (touchEndX < touchStartX - swipeThreshold) {
    changeBookPage(1); // Swipe Left -> Next Page
  }
  if (touchEndX > touchStartX + swipeThreshold) {
    changeBookPage(-1); // Swipe Right -> Prev Page
  }
}

// ==========================================
// Main Game Loop & Logic
// ==========================================
function gameLoop() {
  update();
  render();
  requestAnimationFrame(gameLoop);
}

function update() {
  indicatorFrame += 0.04;

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

// ==========================================
// Modal & Book Functionality
// ==========================================
function triggerInteraction(obj) {
  if (obj.pages && obj.pages.length > 0) {
    modalTitleEl.innerHTML = `<i class="fa-solid fa-book-open"></i> ${obj.title}`;
    currentPages = obj.pages;
    currentPageIndex = 0;
    renderBookPage();
    modalEl.classList.remove('hidden');
  }
}

function renderBookPage() {
  modalBodyEl.innerHTML = `<div class="book-page">${currentPages[currentPageIndex]}</div>`;
  pageIndicatorEl.textContent = `Page ${currentPageIndex + 1} / ${currentPages.length}`;
  
  prevBtnEl.disabled = currentPageIndex === 0;
  nextBtnEl.disabled = currentPageIndex === currentPages.length - 1;
}

function changeBookPage(direction) {
  const newIndex = currentPageIndex + direction;
  if (newIndex >= 0 && newIndex < currentPages.length) {
    currentPageIndex = newIndex;
    renderBookPage();
  }
}

function closeModal() {
  modalEl.classList.add('hidden');
}

function teleportToRoom(roomNum, newX = 32, newY = 32) {
  isTeleporting = true;
  currentRoom = roomNum;
  player.x = newX;
  player.y = newY;
  player.targetX = null;
  player.targetY = null;

  if (roomTitleEl) {
    roomTitleEl.innerHTML = `<i class="fa-solid fa-leaf"></i> ${roomNum === 1 ? "Kovy's Room" : "Commission Room"}`;
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

  const objects = roomObjects[currentRoom] || [];
  for (const obj of objects) {
    if (obj.showArrow) {
      drawBlueArrow(obj);
    }
  }

  if (playerImage.complete && playerImage.naturalWidth !== 0) {
    ctx.drawImage(playerImage, player.x, player.y, player.width, player.height);
  } else {
    ctx.fillStyle = '#f38ba8';
    ctx.fillRect(player.x, player.y, player.width, player.height);
  }
}

function drawBlueArrow(obj) {
  const pCenterX = player.x + player.width / 2;
  const pCenterY = player.y + player.height / 2;
  const oCenterX = obj.x + obj.width / 2;
  const oCenterY = obj.y + obj.height / 2;

  const distance = Math.hypot(pCenterX - oCenterX, pCenterY - oCenterY);
  const isNear = distance < 20;
  const opacity = isNear ? 1.0 : Math.max(0.35, 1 - (distance / 60));

  const bounceY = Math.sin(indicatorFrame) * 1.5;
  const arrowX = oCenterX;
  const arrowY = obj.y - 3 + bounceY;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#89b4fa';

  ctx.beginPath();
  ctx.moveTo(arrowX - 3, arrowY - 4);
  ctx.lineTo(arrowX + 3, arrowY - 4);
  ctx.lineTo(arrowX, arrowY);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

requestAnimationFrame(gameLoop);