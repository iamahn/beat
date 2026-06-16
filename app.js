// =====================================
// AUDIO CONTEXT CONFIG
// =====================================



const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0.5;
masterGain.connect(audioCtx.destination);

// =====================================
// COUNTING VOICE
// =====================================
/*
const voiceUrls = {
    1: 'https://iamahn.github.io/beat/counting_voice/(female)01.wav', 
    2: 'https://iamahn.github.io/beat/counting_voice/(female)02.wav',
    3: 'https://iamahn.github.io/beat/counting_voice/(female)03.wav',
    4: 'https://iamahn.github.io/beat/counting_voice/(female)04.wav',
    5: 'https://iamahn.github.io/beat/counting_voice/(female)05.wav',
    6: 'https://iamahn.github.io/beat/counting_voice/(female)06.wav',
    7: 'https://iamahn.github.io/beat/counting_voice/(female)07.wav',
    8: 'https://iamahn.github.io/beat/counting_voice/(female)08.wav',
    9: 'https://iamahn.github.io/beat/counting_voice/(female)09.wav'
};
*/

const voiceUrls = {
    1: 'https://iamahn.github.io/beat/counting_voice/(female)count(1).wav', 
    2: 'https://iamahn.github.io/beat/counting_voice/(female)count(2).wav',
    3: 'https://iamahn.github.io/beat/counting_voice/(female)count(3).wav',
    4: 'https://iamahn.github.io/beat/counting_voice/(female)count(4).wav',
    5: 'https://iamahn.github.io/beat/counting_voice/(female)count(5).wav',
    6: 'https://iamahn.github.io/beat/counting_voice/(female)count(6).wav',
    7: 'https://iamahn.github.io/beat/counting_voice/(female)count(7).wav',
    8: 'https://iamahn.github.io/beat/counting_voice/(female)count(8).wav',
    9: 'https://iamahn.github.io/beat/counting_voice/(female)count(9).wav'
};


let voiceBuffers = {};

// 페이지 로드 시 wav 파일을 Web Audio Context용 버퍼로 미리 변환
async function loadHumanVoices() {
    for (let beat in voiceUrls) {
        try {
            const response = await fetch(voiceUrls[beat]);
            const arrayBuffer = await response.arrayBuffer();
            voiceBuffers[beat] = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error(`${beat}번 음성 파일을 불러오는데 실패했습니다:`, e);
        }
    }
}
// 초기화 실행
loadHumanVoices();

// 음성 재생용 헬퍼 함수
function playVoice(beatNumber) {
    if (!voiceBuffers[beatNumber]) return; // 파일이 안 들려왔으면 패스
    const source = audioCtx.createBufferSource();
    source.buffer = voiceBuffers[beatNumber];
    source.connect(masterGain);
    source.start();
}

// =====================================
// DOM ELEMENTS MATRIX
// =====================================
const bpmInput = document.getElementById("bpm");
const beatsInput = document.getElementById("beats");
const subdivisionInput = document.getElementById("subdivision");
const soundTypeInput = document.getElementById("soundType");
const accentInput = document.getElementById("accent");
const volumeInput = document.getElementById("volume");
const visualizer = document.getElementById("visualizer");

const timerEnable = document.getElementById("timerEnable");
const timerMinutes = document.getElementById("timerMinutes");
const bpmHub = document.getElementById("bpmHub");
const bpmValue = document.getElementById("bpmValue");

const bpmUpBtn = document.getElementById("bpmUpBtn");
const bpmDownBtn = document.getElementById("bpmDownBtn");
const bpmMinus10Btn = document.getElementById("bpmMinus10Btn");
const bpmMinus5Btn = document.getElementById("bpmMinus5Btn");
const bpmPlus5Btn = document.getElementById("bpmPlus5Btn");
const bpmPlus10Btn = document.getElementById("bpmPlus10Btn");
const timerDisplay = document.getElementById("timerDisplay");
const trainingInfo = document.getElementById("trainingInfo");

const trainingModeCheck = document.getElementById("trainingMode");
const startBpmInput = document.getElementById("startBpm");
const targetBpmInput = document.getElementById("targetBpm");
const stepBpmInput = document.getElementById("stepBpm");
const barsPerStepInput = document.getElementById("barsPerStep");
const measureInput = document.getElementById("measure");

// =====================================
// STATE ENGINE
// =====================================
let intervalId = null;
let timerId = null;
let timerRemaining = 0;

let currentStep = 0;
let totalSteps = 0;
let currentBar = 0;

let currentBpm = 120;
let isRunning = false;
let tapTimes = [];

let trainingEnabled = false;
let barsCompleted = 0;
let targetBpm = 0;
let bpmIncrement = 0;
let barsPerStep = 0;

let bpmHoldInterval = null;
let bpmHoldTimeout = null;
let bpmHoldDirection = 0;

// =====================================
// SUBDIVISION DROPDOWN FILTER
// =====================================
function updateSubdivisionOptions() {
    const timeSig = beatsInput.value;
    const options = subdivisionInput.querySelectorAll("option");
    
    let targetClass = "sub-common";
    if (timeSig === "6/8") targetClass = "sub-68";
    if (timeSig === "2/2") targetClass = "sub-22";

    let firstMatch = null;

    options.forEach(opt => {
        if (opt.classList.contains(targetClass)) {
            opt.hidden = false;
            opt.style.display = "block"; 
            if (!firstMatch) firstMatch = opt;
        } else {
            opt.hidden = true;
            opt.style.display = "none";
        }
    });

    if (firstMatch) {
        subdivisionInput.value = firstMatch.value;
    }
}

function getBeatsCount() {
    return parseInt(beatsInput.value.split('/')[0]) || 4;
}

// =====================================
// VISUALIZER GENERATOR
// =====================================
function createVisualizer() {
    if (!visualizer) return; 
    visualizer.innerHTML = "";

    const beats = getBeatsCount();
    const subdivision = Math.ceil(parseFloat(subdivisionInput.value) || 1);
    totalSteps = beats * subdivision;

    const measureRow = document.createElement('div');
    measureRow.className = 'measure-row current-measure';

    const maxMeasures = measureInput ? parseInt(measureInput.value) : 4;
    const counterDiv = document.createElement('div');
    counterDiv.className = 'measure-counter';
    counterDiv.id = 'liveMeasureCounter';
    counterDiv.innerText = maxMeasures;
    measureRow.appendChild(counterDiv);

    for (let b = 0; b < beats; b++) {
        const box = document.createElement("div");
        box.className = "beat-box";
        box.setAttribute("data-sub", subdivision); 

        for (let s = 0; s < subdivision; s++) {
            const dot = document.createElement("div");
            dot.className = "dot";
            box.appendChild(dot);
        }
        measureRow.appendChild(box);
    }
    visualizer.appendChild(measureRow);
    updateMeasureCounter();
}

function updateMeasureCounter() {
    const counterElement = document.getElementById('liveMeasureCounter');
    if (measureInput && counterElement) {
        const maxMeasures = parseInt(measureInput.value) || 4;
        let remaining = maxMeasures - currentBar; 
        if (remaining < 1) remaining = 1; 
        counterElement.innerText = remaining;
    }
}

function updateVisualizer() {
    const dots = visualizer.querySelectorAll(".dot");
    const boxes = visualizer.querySelectorAll(".beat-box");
    const subdivision = Math.ceil(parseFloat(subdivisionInput.value) || 1);
    
    const currentBeatIndex = Math.floor(currentStep / subdivision);

    dots.forEach(d => d.classList.remove("active", "done", "accent", "pulse"));
    boxes.forEach(b => b.classList.remove("current-beat"));

    for (let i = 0; i < dots.length; i++) {
        if (i < currentStep) dots[i].classList.add("done");
    }
    if (boxes[currentBeatIndex]) {
        boxes[currentBeatIndex].classList.add("current-beat");
    }

    if (dots[currentStep]) {
        dots[currentStep].classList.add("active");
        dots[currentStep].classList.add("pulse");
        if (currentStep === 0 || (currentStep % subdivision === 0 && accentInput.checked)) {
            dots[currentStep].classList.add("accent");
        }
    }
}

// =====================================
// AUDIO CORE LOOP
// =====================================
function playClick(accent, isSubdivision = false) {
    const type = soundTypeInput.value;

    // 🎙️ Human 모드 제어 분기점
    let currentType = type;
    if (type === "human") {
        if (isSubdivision) {
            currentType = "click"; // 엇박(Subdivision) 타이밍에는 깔끔한 메트로놈 땡 소리로 우회
        } else {
            return; // 정박인 경우 목소리를 쏠 것이기 때문에 오실레이터 비프음은 꺼줍니다.
        }
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (currentType === "wood") {
        osc.type = "triangle";
        osc.frequency.value = accent ? 1800 : 1000;
    } else if (currentType === "click") {
        osc.type = "sine";
        osc.frequency.value = accent ? 1500 : 800;
    } else { // beep
        osc.type = "sine";
        osc.frequency.value = accent ? 1000 : 500;
    }

    gain.gain.setValueAtTime(1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function getInterval() {
    const subdivision = parseFloat(subdivisionInput.value) || 1;
    return 60000 / (currentBpm * subdivision);
}

function updateTrainingInfoText(isFirstStart = false) {
    if (trainingInfo) {
        if (trainingEnabled && isRunning) {
            trainingInfo.style.color = "red"; 
            trainingInfo.style.fontWeight = "bold";
            
            if (isFirstStart) {
                trainingInfo.innerHTML = "[ TRAINING MODE ] 🏋️ 트레이닝 시작! 목표를 향해 속도를 높입니다.";
            } else {
                trainingInfo.innerHTML = `[ TRAINING MODE ] ${barsCompleted + 1} / ${barsPerStep} 마디 진행 중 (${Math.round(currentBpm)} BPM)`;
            }
        } else {
            trainingInfo.innerHTML = "&nbsp;";
        }
    }
}

function tick() {
    const subdivision = Math.ceil(parseFloat(subdivisionInput.value) || 1);
    const beatsCount = getBeatsCount();

    // 현재 마디 내부에서의 박자 위치 계산 (1박, 2박, 3박...)
    const currentBeatNumber = Math.floor(currentStep / subdivision) + 1;
    // 현재 타이밍이 '정박'인지 쪼개진 '엇박(Subdivision)'인지 판별
    const isSubdivision = (currentStep % subdivision !== 0);
    const accent = accentInput.checked && (currentStep === 0);

    // 🎙️ 오디오 소스 출력 분기 시스템
    if (soundTypeInput.value === "human") {
        if (!isSubdivision) {
            // 정박일 때 준비된 목소리 버퍼 로드 후 재생
            // 혹시 박자 수(Beats)가 준비된 파일 최대치(9)를 초과할 경우 루프 처리 순환
            const voiceIndex = currentBeatNumber <= 9 ? currentBeatNumber : ((currentBeatNumber - 1) % 9) + 1;
            playVoice(voiceIndex);
        } else {
            // 정박 사이 엇박에는 메커니컬 클릭 사운드로 "땡" 처리
            playClick(false, true);
        }
    } else {
        // 기존 전자 신호음 모드일 때
        playClick(accent, isSubdivision); 
    }

    updateVisualizer();
    
    if (currentStep === 0) {
        bpmHub.classList.remove("pulse");
        void bpmHub.offsetWidth; 
        bpmHub.classList.add("pulse");
    }

    currentStep++;

    if (currentStep >= totalSteps) {
        currentStep = 0;
        currentBar++; 
        
        if (trainingEnabled) {
            barsCompleted++;
            
            if (barsCompleted >= barsPerStep) {
                barsCompleted = 0; 
                currentBar = 0; 
                const nextBpm = currentBpm + bpmIncrement;
                
                if (nextBpm >= targetBpm) {
                    setBpm(targetBpm);
                    stopMetronome();
                    if (trainingInfo) {
                        trainingInfo.style.color = "red";
                        trainingInfo.innerHTML = "[ TRAINING COMPLETE ] 🎉 목표 BPM에 도달하여 트레이닝을 완료했습니다!";
                    }
                    return;
                } else {
                    setBpm(nextBpm);
                    updateTrainingInfoText(false);
                }
            } else {
                updateTrainingInfoText(false);
            }
        } else {
            if (measureInput) {
                const maxMeasures = parseInt(measureInput.value) || 4;
                if (currentBar >= maxMeasures) {
                    currentBar = 0; 
                }
            }
        }
        updateMeasureCounter();
    }
}

// =====================================
// HANDLERS & ACCELERATION ENGINE
// =====================================
function setBpm(value) {
    currentBpm = Math.max(20, Math.min(400, value));
    if (bpmInput) bpmInput.value = currentBpm;
    bpmValue.textContent = Math.round(currentBpm);

    if (isRunning) {
        clearInterval(intervalId);
        intervalId = setInterval(tick, getInterval());
    }
}

function startMetronome() {
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    stopMetronome();

    currentStep = 0;
    currentBar = 0;

    initTraining(); 
    createVisualizer();

    isRunning = true;
    bpmHub.classList.add("running");
    intervalId = setInterval(tick, getInterval());
    startTimer();
    
    updateTrainingInfoText(true);
}

function stopMetronome() {
    clearInterval(intervalId);
    clearInterval(timerId);
    intervalId = null;
    timerId = null;
    isRunning = false;
    bpmHub.classList.remove("running");
    
    updateTrainingInfoText(false);
}

// =====================================
// EVENT CONTROLS
// =====================================
function startHold(direction) {
    bpmHoldDirection = direction;
    setBpm(currentBpm + direction);
    clearTimeout(bpmHoldTimeout);
    clearInterval(bpmHoldInterval);
    bpmHoldTimeout = setTimeout(() => {
        bpmHoldInterval = setInterval(() => {
            setBpm(currentBpm + bpmHoldDirection);
        }, 80);
    }, 400);
}

function stopHold() {
    if (bpmHoldTimeout) clearTimeout(bpmHoldTimeout);
    if (bpmHoldInterval) clearInterval(bpmHoldInterval);
}

function bindHold(btn, direction) {
    if (!btn) return;
    btn.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 && e.pointerType === "mouse") return;
        e.preventDefault();
        startHold(direction);
    });
    btn.addEventListener("pointerup", stopHold);
    btn.addEventListener("pointerleave", stopHold);
    btn.addEventListener("pointercancel", stopHold);
}

function startTimer() {
    if (!timerEnable.checked) {
        timerDisplay.textContent = "∞";
        return;
    }
    const minutes = parseInt(timerMinutes.value || "0");
    if (minutes <= 0) {
        timerDisplay.textContent = "∞";
        return;
    }
    timerRemaining = minutes * 60;
    timerDisplay.textContent = formatTime(timerRemaining);

    timerId = setInterval(() => {
        timerRemaining--;
        timerDisplay.textContent = formatTime(timerRemaining);
        if (timerRemaining <= 0) stopMetronome();
    }, 1000);
}

function formatTime(sec) {
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;
}

function tapTempo() {
    const now = performance.now();
    tapTimes.push(now);
    if (tapTimes.length > 6) tapTimes.shift();
    if (tapTimes.length < 2) return;
    let intervals = [];
    for (let i = 1; i < tapTimes.length; i++) {
        intervals.push(tapTimes[i] - tapTimes[i - 1]);
    }
    setBpm(Math.round(60000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length)));
}

function initTraining() {
    trainingEnabled = trainingModeCheck ? trainingModeCheck.checked : false;
    if (!trainingEnabled) return;

    let rawStart = startBpmInput ? parseInt(startBpmInput.value) : 120;
    let rawTarget = targetBpmInput ? parseInt(targetBpmInput.value) : 140;
    bpmIncrement = stepBpmInput ? parseInt(stepBpmInput.value) : 5;       
    barsPerStep = barsPerStepInput ? parseInt(barsPerStepInput.value) : 4;

    targetBpm = Math.max(20, rawTarget);              
    barsCompleted = 0;
    currentBar = 0; 
    setBpm(Math.max(20, rawStart));
}

bindHold(bpmUpBtn, +1); bindHold(bpmDownBtn, -1);
bindHold(bpmPlus5Btn, +5); bindHold(bpmMinus5Btn, -5);
bindHold(bpmPlus10Btn, +10); bindHold(bpmMinus10Btn, -10);

bpmHub.addEventListener("click", () => {
    if (isRunning) stopMetronome();
    else startMetronome();
});

document.getElementById("tapBtn").addEventListener("click", tapTempo);

beatsInput.addEventListener("change", () => {
    updateSubdivisionOptions();
    createVisualizer();
});

subdivisionInput.addEventListener("change", createVisualizer);

volumeInput.addEventListener("input", (e) => {
    masterGain.gain.value = parseFloat(e.target.value);
});

if (trainingModeCheck) trainingModeCheck.addEventListener("change", initTraining);
if (startBpmInput) startBpmInput.addEventListener("input", initTraining);
if (targetBpmInput) targetBpmInput.addEventListener("input", initTraining);
if (stepBpmInput) stepBpmInput.addEventListener("input", initTraining);
if (barsPerStepInput) barsPerStepInput.addEventListener("input", initTraining);
if (measureInput) {
    measureInput.addEventListener("input", () => {
        initTraining();
        createVisualizer(); 
    });
}

document.addEventListener("DOMContentLoaded", () => {
    updateSubdivisionOptions(); 
    createVisualizer();
    if (bpmInput) currentBpm = parseInt(bpmInput.value) || 120;
    bpmValue.textContent = currentBpm;
});
