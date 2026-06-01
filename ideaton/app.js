// State Management
let currentStep = 1;
let isProfVideoApproved = false;
let studentCurrentTime = 930; // Starts at 15:30 (930 seconds)
const videoDuration = 2062; // 34:22 (2062 seconds)
let quizAnswersConnected = {}; // leftNodeId -> rightNodeTarget
let selectedLeftNode = null;
let selectedCaptchaTiles = new Set();
let reviewModeActive = false;

// Audio context / animation variables
let canvasAnimFrames = {};

// Step Explanations for Ideathon Pitch
const stepExplanations = {
  1: `<strong>[1단계] 교수자 시점 (초자동화 행정):</strong> 교수가 영상을 업로드(또는 촬영 종료)하면, CUAI가 영상의 소리와 화면을 분석하여 타임라인별 소주제 목차를 생성합니다. 교수는 <strong>'승인'</strong> 버튼 하나만 눌러 공유대학 포털에 반영합니다. 우측 하단의 [AI 생성 타임스탬프 원클릭 승인] 버튼을 눌러보세요.`,
  2: `<strong>[2단계] 학생 시점 (시맨틱 통합 검색):</strong> CUAI가 추출한 지식 데이터(STT/OCR)는 포털 검색엔진과 연동됩니다. 학생이 "역전파 알고리즘"을 검색하면 해당 단어가 등장하는 정확한 영상의 분/초(Timestamp)로 다이렉트 연결 링크가 제공됩니다. 결과 카드 내부의 <strong>[15분 30초]</strong> 등의 타임스탬프 버튼을 클릭해 보세요.`,
  3: `<strong>[3단계] 학생 시점 (Quiz):</strong> 학생이 15분 30초(역전파 알고리즘) 지점을 지날 때, 챗GPT 복붙이 불가능한 시각/공간 인지 퀴즈가 우측에 팝업됩니다. 마우스 드래그/클릭으로 개념을 올바른 순서로 연결하고, 캡차에서 로봇들을 올바르게 골라 정답을 제출해보세요.`,
  4: `<strong>[4단계] 피드백 루프 (적응형 복습):</strong> 퀴즈를 틀릴 경우 단순 오답으로 끝나지 않고, CUAI가 해당 오답이 설명되었던 11차시 강의의 <strong>[08분 15초] (과목 예시의 정의)</strong> 복습 구간으로 자동 브랜칭(이동)시켜 개념 재학습을 강제 유도합니다.`,
  5: `<strong>[5단계] Quiz 단독 보기 (독립 평가 화면):</strong> 강의 동영상 화면을 배제하고 오직 캔버스 노드 선 연결과 이미지 캡차형 퀴즈로만 구성된 **Quiz 단독 수강 평가 화면**을 시연합니다.`
};

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  initVideoPlayer('prof-video-canvas', videoDuration, true);
  initVideoPlayer('student-video-canvas', studentCurrentTime, false);
  renderCaptchaGrid();
  initNodeGame();
  
  // Set default search results
  runSemanticSearch("역전파 알고리즘");

  // Event Listeners
  document.getElementById('prof-approve-btn').addEventListener('click', handleProfessorApproval);
  document.getElementById('portal-search-btn').addEventListener('click', () => {
    const query = document.getElementById('portal-search-bar').value;
    runSemanticSearch(query);
  });
  document.getElementById('btn-quiz-submit').addEventListener('click', submitStudentQuiz);
  document.getElementById('btn-popup-confirm').addEventListener('click', triggerAdaptiveBranching);
  document.getElementById('btn-reset-nodes').addEventListener('click', resetNodeGame);
  
  // Floating Controller Collapse/Expand toggle
  document.getElementById('tour-toggle-btn').addEventListener('click', () => {
    const controller = document.getElementById('bottom-tour-controller');
    const btn = document.getElementById('tour-toggle-btn');
    controller.classList.toggle('collapsed');
    if (controller.classList.contains('collapsed')) {
      btn.textContent = '제어기 펼치기 ▾';
    } else {
      btn.textContent = '제어기 접기 ▴';
    }
  });

  // Resize canvas handler
  window.addEventListener('resize', () => {
    drawNodeConnections();
  });
});

// Activate Perspective Step
function activateStep(step) {
  currentStep = step;
  
  // Update floating controls active class
  const buttons = document.querySelectorAll('.tour-btn');
  buttons.forEach((btn, idx) => {
    if (idx + 1 === step) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update explanation
  document.getElementById('tour-explanation').innerHTML = stepExplanations[step];

  // Toggle active view panels
  const viewProf = document.getElementById('view-professor');
  const viewSearch = document.getElementById('view-student-search');
  const viewQuiz = document.getElementById('view-student-quiz');

  // Deactivate all animations loops
  cancelAnimationFrame(canvasAnimFrames['prof-video-canvas']);
  cancelAnimationFrame(canvasAnimFrames['student-video-canvas']);

  if (step === 1) {
    viewProf.classList.add('active');
    viewSearch.classList.remove('active');
    viewQuiz.classList.remove('active');
    initVideoPlayer('prof-video-canvas', videoDuration, true);
  } else if (step === 2) {
    viewProf.classList.remove('active');
    viewSearch.classList.add('active');
    viewQuiz.classList.remove('active');
  } else if (step === 3) {
    viewProf.classList.remove('active');
    viewSearch.classList.remove('active');
    viewQuiz.classList.add('active');
    viewQuiz.classList.remove('quiz-only-mode'); // Show video player
    
    // Normal play at 15:30
    studentCurrentTime = 930;
    reviewModeActive = false;
    document.getElementById('review-bubble-indicator').style.display = 'none';
    document.getElementById('quiz-player-ai-tip').style.display = 'block';
    document.getElementById('quiz-player-ai-text').innerHTML = `역전파 구간(15:30)에 도달하여 우측에 <strong>Anti-Cheating 개념 확인 퀴즈</strong>가 출제되었습니다.`;
    
    updateStudentTimeline(930);
    initVideoPlayer('student-video-canvas', studentCurrentTime, false);
    resetNodeGame();
    selectedCaptchaTiles.clear();
    renderCaptchaGrid();
  } else if (step === 4) {
    viewProf.classList.remove('active');
    viewSearch.classList.remove('active');
    viewQuiz.classList.add('active');
    viewQuiz.classList.remove('quiz-only-mode'); // Show video player

    // Trigger Quiz Failure -> Adaptive Branching Popup
    document.getElementById('adaptive-branching-modal').classList.add('active');
  } else if (step === 5) {
    viewProf.classList.remove('active');
    viewSearch.classList.remove('active');
    viewQuiz.classList.add('active');
    viewQuiz.classList.add('quiz-only-mode'); // Hide video player, show only quiz
    
    // Normal play at 15:30, but hide video overlay tips
    studentCurrentTime = 930;
    reviewModeActive = false;
    document.getElementById('review-bubble-indicator').style.display = 'none';
    document.getElementById('quiz-player-ai-tip').style.display = 'none';
    
    updateStudentTimeline(930);
    initVideoPlayer('student-video-canvas', studentCurrentTime, false);
    resetNodeGame();
    selectedCaptchaTiles.clear();
    renderCaptchaGrid();
  }
}

// Simulated Video Draw & Animation Loop
function initVideoPlayer(canvasId, startTime, isProfView) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let localTime = startTime;
  let isPlaying = true;

  if (canvasId === 'student-video-canvas') {
    localTime = studentCurrentTime;
  }

  function loop() {
    drawVideoSlide(ctx, localTime, isProfView);
    
    if (isPlaying && !isProfView) {
      // simulate slow playback increment
      localTime += 0.05;
      if (localTime >= videoDuration) {
        localTime = startTime;
      }
      studentCurrentTime = Math.floor(localTime);
      updateStudentTimeline(studentCurrentTime);
    }
    
    canvasAnimFrames[canvasId] = requestAnimationFrame(loop);
  }
  
  loop();
}

function updateStudentTimeline(seconds) {
  const fill = document.getElementById('student-timeline-fill');
  const marker = document.getElementById('student-timeline-marker');
  const tag = document.getElementById('student-timeline-tag');
  const curTimeText = document.getElementById('student-current-time');
  
  const percentage = (seconds / videoDuration) * 100;
  
  if (fill) fill.style.width = `${percentage}%`;
  if (marker) marker.style.left = `${percentage}%`;
  if (curTimeText) curTimeText.textContent = formatTime(seconds);
  if (tag) {
    tag.style.left = `${percentage}%`;
    tag.textContent = formatTime(seconds);
  }
}

// Clean White Board Canvas Drawing showing "강의 영상 예시"
function drawVideoSlide(ctx, time, isProfView) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  
  // Clean White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  
  // Light gray internal slide border
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  
  // Center Text: "강의 영상 예시"
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 22px "Noto Sans KR"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('강의 영상 예시', w / 2, h / 2 - 15);
  
  // Sub-text: Playback indicator showing current time
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 13px "Outfit", "Noto Sans KR", sans-serif';
  ctx.fillText(`[ 재생 시간: ${formatTime(time)} ]`, w / 2, h / 2 + 25);
}

// Format seconds into MM:SS
function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

// Professor Click Approve Flow
function handleProfessorApproval() {
  const btn = document.getElementById('prof-approve-btn');
  const rows = document.querySelectorAll('.timestamp-row');
  const logs = document.getElementById('ai-terminal-logs');
  
  // Glow effect on stamps
  rows.forEach(row => {
    row.classList.add('glowing');
  });

  // Append new system log
  const newLog = document.createElement('div');
  newLog.className = 'terminal-line';
  newLog.style.color = '#38bdf8';
  newLog.innerHTML = `<span class="time">[SYSTEM]</span> 타임스탬프 원클릭 승인 완료! 통합 검색엔진 즉시 인덱싱 & 적응형 퀴즈 배포 완료.`;
  logs.appendChild(newLog);
  logs.scrollTop = logs.scrollHeight;

  // Change button style
  btn.classList.add('approved');
  btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> <span>승인 및 통합 완료</span>`;
  isProfVideoApproved = true;

  // Visual Alert popup
  alert('🎉 교수자 승인 완료!\n영상의 소주제 정보가 공유대학 포털 아카이브 시맨틱 검색 엔진에 연동되었으며, 학생용 인지 기반 Smart 퀴즈가 활성화되었습니다.');
  
  // Auto advance to step 2 after a small delay
  setTimeout(() => {
    activateStep(2);
  }, 1200);
}

// Semantic Search Engine Emulation
const mockDatabase = [
  {
    univ: '가톨릭공유대학',
    course: '과목 예시',
    prof: '교수 이름',
    title: '11차시 1차시 - chapter 6 과목 예시에게 언어 처리를 시켜보자(1)',
    snippet: '이것이 바로 <strong>역전파 알고리즘</strong>의 핵심 메커니즘입니다. 에러(손실)를 반대 방향으로 추적하여 가중치를 최적화하는...',
    stamps: [
      { label: '역전파 알고리즘의 개념', time: 930 }, // 15:30
      { label: '가중치 경사하강 수식유도', time: 1210 } // 20:10
    ]
  },
  {
    univ: '가톨릭공유대학',
    course: '인공지능 개론',
    prof: '김기철 교수님',
    title: '6차시 2차시 - 다층 퍼셉트론과 신경망 최적화 학습',
    snippet: '다층 퍼셉트론(MLP) 신경망의 가중치 학습을 위해 <strong>역전파 알고리즘</strong>을 도식화하고 미분 연쇄 법칙(Chain Rule)을 적용하는...',
    stamps: [
      { label: '역전파 알고리즘 수학적 도출', time: 2535 }, // 42:15
      { label: '체인룰 편미분 계산', time: 2820 } // 47:00
    ]
  },
  {
    univ: '가톨릭공유대학',
    course: '딥러닝 실습',
    prof: '이정훈 교수님',
    title: '2차시 1차시 - PyTorch 프레임워크 기초 및 훈련 실습',
    snippet: '직접 손으로 계산했던 가중치 미분 과정을 파이토치의 Autograd 모듈과 loss.backward()로 자동화하는 <strong>역전파 알고리즘</strong> 실무 코딩...',
    stamps: [
      { label: 'PyTorch backward 코드 실습', time: 500 } // 08:20
    ]
  }
];

function setSearchValue(val) {
  document.getElementById('portal-search-bar').value = val;
  runSemanticSearch(val);
}

function runSemanticSearch(query) {
  const container = document.getElementById('portal-search-results');
  container.innerHTML = '';
  
  if (!query.trim()) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">검색어를 입력해주세요.</div>';
    return;
  }

  // filter mockup database based on queries (fuzzy check)
  const results = mockDatabase.filter(item => {
    return item.title.includes(query) || item.snippet.includes(query) || item.stamps.some(s => s.label.includes(query)) || query === '역전파 알고리즘';
  });

  if (results.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:40px; color:var(--text-muted);">"시맨틱 아카이브" 내에 관련 소주제 분석 결과가 없습니다.</div>';
    return;
  }

  results.forEach((res, index) => {
    const card = document.createElement('div');
    card.className = `search-result-card ${index === 0 ? 'search-highlight' : ''}`;
    
    let stampButtonsHTML = '';
    res.stamps.forEach(st => {
      const timeStr = formatTime(st.time);
      // deep link action
      stampButtonsHTML += `
        <button class="deep-link-btn" onclick="triggerDeepLink('${res.course}', ${st.time})">
          <span class="time-indicator">⏱ ${timeStr}</span>
          <span>${st.label}</span>
        </button>
      `;
    });

    card.innerHTML = `
      <div class="result-card-header">
        <span class="result-univ-badge">${res.univ} (${res.course})</span>
        <span class="result-prof-name">${res.prof}</span>
      </div>
      <h3 class="result-card-title">${res.title}</h3>
      <p class="result-snippet">${res.snippet}</p>
      <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:8px; font-weight:bold;">📍 매칭된 정확한 영상 강의 구간 바로가기:</div>
      <div class="deep-link-stamps-row">
        ${stampButtonsHTML}
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Deep Linking Trigger (from Search Portal to exact Timestamp in lecture room)
function triggerDeepLink(course, targetSeconds) {
  alert(`🔗 시맨틱 딥링크 연결!\n[${course}] 강의의 [${formatTime(targetSeconds)}] 지점으로 바로 이동합니다.`);
  
  // Switch to student view (Step 3)
  activateStep(3);
  
  // Adjust time state
  studentCurrentTime = targetSeconds;
  updateStudentTimeline(studentCurrentTime);
  
  // restart video player at targetSeconds
  initVideoPlayer('student-video-canvas', targetSeconds, false);

  // Update prompt indicator
  const tip = document.getElementById('quiz-player-ai-tip');
  const tipText = document.getElementById('quiz-player-ai-text');
  tip.style.display = 'block';
  
  if (targetSeconds === 930) {
    tipText.innerHTML = `검색어 <strong>'역전파 알고리즘의 개념(15:30)'</strong> 매칭 지점으로 바로가기 완료. 우측에 생성된 퀴즈를 확인하세요!`;
  } else {
    tipText.innerHTML = `딥링크 검색 지점인 <strong>${formatTime(targetSeconds)}</strong>으로 자동 점프 완료!`;
  }
}

// VECTOR CAPTCHA IMAGES GENERATOR (SVGs)
const captchaGraphics = {
  humanoid1: `
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="45" r="25" fill="#f8fafc" stroke="#334155" stroke-width="3"/>
      <circle cx="40" cy="42" r="4" fill="#6366f1"/>
      <circle cx="60" cy="42" r="4" fill="#6366f1"/>
      <path d="M40 58 Q50 68 60 58" stroke="#334155" stroke-width="3" fill="none"/>
      <rect x="42" y="70" width="16" height="15" rx="3" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>
    </svg>`,
  industrial: `
    <svg viewBox="0 0 100 100">
      <rect x="20" y="80" width="60" height="10" fill="#64748b"/>
      <rect x="42" y="40" width="16" height="40" fill="#94a3b8" stroke="#334155" stroke-width="2"/>
      <line x1="50" y1="40" x2="70" y2="20" stroke="#334155" stroke-width="4"/>
      <circle cx="70" cy="20" r="6" fill="#ef4444"/>
      <path d="M65 14 L75 14 M65 26 L75 26" stroke="#334155" stroke-width="3"/>
    </svg>`,
  vacuum: `
    <svg viewBox="0 0 100 100">
      <ellipse cx="50" cy="60" rx="35" ry="20" fill="#e2e8f0" stroke="#334155" stroke-width="3"/>
      <ellipse cx="50" cy="55" rx="30" ry="15" fill="#94a3b8"/>
      <circle cx="50" cy="50" r="6" fill="#3b82f6"/>
      <path d="M25 60 L15 70" stroke="#64748b" stroke-width="2"/>
    </svg>`,
  humanoid2: `
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="30" r="14" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
      <circle cx="45" cy="28" r="2" fill="#10b981"/>
      <circle cx="55" cy="28" r="2" fill="#10b981"/>
      <rect x="35" y="48" width="30" height="32" rx="5" fill="#f1f5f9" stroke="#334155" stroke-width="2"/>
      <line x1="50" y1="44" x2="50" y2="48" stroke="#334155" stroke-width="3"/>
      <line x1="28" y1="52" x2="28" y2="70" stroke="#334155" stroke-width="3"/>
      <line x1="72" y1="52" x2="72" y2="70" stroke="#334155" stroke-width="3"/>
    </svg>`,
  drone: `
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="10" fill="#334155"/>
      <line x1="20" y1="20" x2="80" y2="80" stroke="#475569" stroke-width="4"/>
      <line x1="80" y1="20" x2="20" y2="80" stroke="#475569" stroke-width="4"/>
      <rect x="12" y="12" width="16" height="4" fill="#1e293b"/>
      <rect x="72" y="12" width="16" height="4" fill="#1e293b"/>
      <rect x="12" y="84" width="16" height="4" fill="#1e293b"/>
      <rect x="72" y="84" width="16" height="4" fill="#1e293b"/>
    </svg>`,
  humanoid3: `
    <svg viewBox="0 0 100 100">
      <!-- Humanoid full body standing -->
      <circle cx="50" cy="20" r="10" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
      <rect x="38" y="34" width="24" height="30" rx="4" fill="#e2e8f0" stroke="#334155" stroke-width="2"/>
      <rect x="42" y="64" width="6" height="24" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>
      <rect x="52" y="64" width="6" height="24" fill="#cbd5e1" stroke="#334155" stroke-width="2"/>
      <circle cx="50" cy="48" r="4" fill="#ec4899"/>
    </svg>`,
  microchip: `
    <svg viewBox="0 0 100 100">
      <rect x="25" y="25" width="50" height="50" rx="4" fill="#065f46" stroke="#047857" stroke-width="3"/>
      <rect x="40" y="40" width="20" height="20" fill="#1e293b"/>
      <line x1="25" y1="35" x2="15" y2="35" stroke="#fbbf24" stroke-width="2"/>
      <line x1="25" y1="50" x2="15" y2="50" stroke="#fbbf24" stroke-width="2"/>
      <line x1="25" y1="65" x2="15" y2="65" stroke="#fbbf24" stroke-width="2"/>
      <line x1="75" y1="35" x2="85" y2="35" stroke="#fbbf24" stroke-width="2"/>
      <line x1="75" y1="50" x2="85" y2="50" stroke="#fbbf24" stroke-width="2"/>
      <line x1="75" y1="65" x2="85" y2="65" stroke="#fbbf24" stroke-width="2"/>
    </svg>`,
  humanoid4: `
    <svg viewBox="0 0 100 100">
      <!-- Robot Face Side view -->
      <path d="M30 20 C60 15, 75 35, 75 55 C75 75, 55 80, 45 80 L35 80 C35 70, 30 65, 30 50 Z" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
      <circle cx="58" cy="40" r="5" fill="#3b82f6"/>
      <path d="M58 60 Q65 60 62 65" stroke="#334155" stroke-width="2"/>
      <rect x="25" y="45" width="10" height="20" fill="#cbd5e1"/>
    </svg>`,
  server: `
    <svg viewBox="0 0 100 100">
      <rect x="25" y="15" width="50" height="70" rx="3" fill="#1e293b" stroke="#475569" stroke-width="2"/>
      <rect x="30" y="23" width="40" height="10" fill="#0f172a"/>
      <rect x="30" y="45" width="40" height="10" fill="#0f172a"/>
      <rect x="30" y="67" width="40" height="10" fill="#0f172a"/>
      <circle cx="35" cy="28" r="2" fill="#22c55e"/>
      <circle cx="35" cy="50" r="2" fill="#22c55e"/>
      <circle cx="35" cy="72" r="2" fill="#ef4444"/>
    </svg>`
};

const captchaTilesData = [
  { id: 'tile-1', type: 'humanoid1', name: '과목 예시 A', isCorrect: true },
  { id: 'tile-2', type: 'industrial', name: '산업용 로봇', isCorrect: false },
  { id: 'tile-3', type: 'vacuum', name: '청소 로봇', isCorrect: false },
  { id: 'tile-4', type: 'humanoid2', name: '과목 예시 B', isCorrect: true },
  { id: 'tile-5', type: 'drone', name: '배달 드론', isCorrect: false },
  { id: 'tile-6', type: 'humanoid3', name: '과목 예시 C', isCorrect: true },
  { id: 'tile-7', type: 'microchip', name: '마이크로칩', isCorrect: false },
  { id: 'tile-8', type: 'humanoid4', name: '과목 예시 D', isCorrect: true },
  { id: 'tile-9', type: 'server', name: '서버 랙', isCorrect: false }
];

function renderCaptchaGrid() {
  const grid = document.getElementById('captcha-grid');
  grid.innerHTML = '';
  
  captchaTilesData.forEach(tile => {
    const el = document.createElement('div');
    el.className = 'captcha-tile';
    el.id = tile.id;
    if (selectedCaptchaTiles.has(tile.id)) {
      el.classList.add('selected');
    }
    
    el.innerHTML = `
      ${captchaGraphics[tile.type]}
      <span class="captcha-label">${tile.name}</span>
    `;
    
    el.addEventListener('click', () => {
      if (selectedCaptchaTiles.has(tile.id)) {
        selectedCaptchaTiles.delete(tile.id);
        el.classList.remove('selected');
      } else {
        selectedCaptchaTiles.add(tile.id);
        el.classList.add('selected');
      }
    });

    grid.appendChild(el);
  });
}

// 7. NODE CONNECTION GAME LOGIC (Quiz 1)
function initNodeGame() {
  const leftNodes = document.querySelectorAll('#node-left-col .connector-node');
  const rightNodes = document.querySelectorAll('#node-right-col .connector-node');
  
  leftNodes.forEach(node => {
    node.addEventListener('click', () => {
      // Toggle select
      if (selectedLeftNode === node) {
        node.classList.remove('selected');
        selectedLeftNode = null;
      } else {
        if (selectedLeftNode) {
          selectedLeftNode.classList.remove('selected');
        }
        selectedLeftNode = node;
        node.classList.add('selected');
      }
    });
  });

  rightNodes.forEach(node => {
    node.addEventListener('click', () => {
      if (selectedLeftNode) {
        const leftId = selectedLeftNode.getAttribute('data-id');
        const rightTarget = node.getAttribute('data-target');

        // Store connection
        quizAnswersConnected[leftId] = rightTarget;
        
        // Add class
        selectedLeftNode.classList.add('connected');
        node.classList.add('connected');
        
        // Deselect
        selectedLeftNode.classList.remove('selected');
        selectedLeftNode = null;

        // Draw connections on canvas
        drawNodeConnections();
      }
    });
  });
}

function resetNodeGame() {
  quizAnswersConnected = {};
  selectedLeftNode = null;
  const nodes = document.querySelectorAll('.connector-node');
  nodes.forEach(n => {
    n.classList.remove('connected');
    n.classList.remove('selected');
  });
  
  const canvas = document.getElementById('node-canvas');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawNodeConnections() {
  const canvas = document.getElementById('node-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Set dimensions based on container bounding
  const container = document.getElementById('node-game-area');
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Iterate and draw lines
  Object.keys(quizAnswersConnected).forEach(leftId => {
    const leftNode = document.querySelector(`#node-left-col .connector-node[data-id="${leftId}"]`);
    const rightTarget = quizAnswersConnected[leftId];
    const rightNode = document.querySelector(`#node-right-col .connector-node[data-target="${rightTarget}"]`);
    
    if (leftNode && rightNode) {
      const leftRect = leftNode.getBoundingClientRect();
      const rightRect = rightNode.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      const x1 = leftRect.right - containerRect.left;
      const y1 = leftRect.top + leftRect.height / 2 - containerRect.top;
      const x2 = rightRect.left - containerRect.left;
      const y2 = rightRect.top + rightRect.height / 2 - containerRect.top;

      // Draw connection line
      ctx.strokeStyle = '#10b981'; // Green for connected
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      
      // Control points for smooth bezier curve
      ctx.bezierCurveTo(x1 + 40, y1, x2 - 40, y2, x2, y2);
      ctx.stroke();

      // Small terminal dots
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(x1, y1, 4, 0, Math.PI*2);
      ctx.arc(x2, y2, 4, 0, Math.PI*2);
      ctx.fill();
    }
  });
}

// 8. STUDENT QUIZ SUBMISSION (Cheating Validation & Adaptive Branching Trigger)
function submitStudentQuiz() {
  // 1. Validate Node Connections
  // Expected links:
  // forward -> forward, loss -> loss, grad -> grad, update -> update
  const totalConnections = Object.keys(quizAnswersConnected).length;
  let isNodeCorrect = true;
  
  if (totalConnections < 4) {
    isNodeCorrect = false;
  } else {
    if (quizAnswersConnected['forward'] !== 'forward' ||
        quizAnswersConnected['loss'] !== 'loss' ||
        quizAnswersConnected['grad'] !== 'grad' ||
        quizAnswersConnected['update'] !== 'update') {
      isNodeCorrect = false;
    }
  }

  // 2. Validate Captcha Select
  // Correct tiles to select are humanoid1, humanoid2, humanoid3, humanoid4
  // IDs: tile-1, tile-4, tile-6, tile-8
  const correctTileIds = ['tile-1', 'tile-4', 'tile-6', 'tile-8'];
  let isCaptchaCorrect = true;
  
  if (selectedCaptchaTiles.size !== correctTileIds.length) {
    isCaptchaCorrect = false;
  } else {
    correctTileIds.forEach(id => {
      if (!selectedCaptchaTiles.has(id)) {
        isCaptchaCorrect = false;
      }
    });
  }

  // Check overall result
  if (isNodeCorrect && isCaptchaCorrect) {
    alert('🎉 개념 평가 만점! 출석 인정을 위한 인지 확인 퀴즈 통과 완료!');
    
    // Switch to step 4 as successful loop display
    document.getElementById('quiz-player-ai-tip').style.display = 'block';
    document.getElementById('quiz-player-ai-text').innerHTML = `💡 <strong>학습 성공!</strong> 퀴즈를 모두 통과하여 11차시 출석 인증 및 평가가 최종 완료되었습니다.`;
  } else {
    // Failure -> Trigger Adaptive Branching Loop!
    alert('❌ 오답 발생!\n제출하신 답변 중 올바르지 않은 시공간 매칭이 발견되었습니다. CUAI가 맞춤형 보충 학습을 배정합니다.');
    
    activateStep(4); // Switches to step 4: Shows the adaptive branching popup
  }
}

// Trigger Adaptive Branching (Jumps video player back to 08:15 definition section)
function triggerAdaptiveBranching() {
  // Close modal
  document.getElementById('adaptive-branching-modal').classList.remove('active');
  
  // Set review mode states
  reviewModeActive = true;
  studentCurrentTime = 495; // 08:15 (495 seconds)
  updateStudentTimeline(495);
  
  // Update Player UI Info
  document.getElementById('quiz-player-ai-tip').style.display = 'block';
  document.getElementById('quiz-player-ai-text').innerHTML = `🚨 <strong>보충 복습 가이드 중</strong><br>과목 예시의 정의(08:15) 구간을 다시 수강하는 동안 퀴즈가 비활성화됩니다.`;
  
  // Show the review bubble card below player
  document.getElementById('review-bubble-indicator').style.display = 'block';
  
  // Restart simulated video canvas loop at 08:15
  initVideoPlayer('student-video-canvas', 495, false);

  alert('🔄 적응형 복습 구간 랜딩 완료!\n오답 원인이 된 8분 15초(과목 예시 정의) 구간으로 동영상이 자동 리와인드 되었습니다.\n해당 구간 수강 후 다시 평가에 도전하실 수 있습니다.');
}
