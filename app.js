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

let voiceBuffers = {};
let currentVoiceSource = null;
let currentVoiceGain = null;

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
loadHumanVoices();

function playVoice(beatNumber) {
    if (!voiceBuffers[beatNumber]) return;
    
    const now = audioCtx.currentTime;

    if (currentVoiceSource && currentVoiceGain) {
        try {
            currentVoiceGain.gain.setValueAtTime(currentVoiceGain.gain.value, now);
            currentVoiceGain.gain.linearRampToValueAtTime(0, now + 0.005);
            currentVoiceSource.stop(now + 0.005);
        } catch (err) {}
    }

    const source = audioCtx.createBufferSource();
    const voiceGain = audioCtx.createGain();
    
    source.buffer = voiceBuffers[beatNumber];
    voiceGain.gain.setValueAtTime(1.0, now);
    
    if (currentBpm > 120) {
        source.playbackRate.value = currentBpm / 120; 
    }
    
    source.connect(voiceGain);
    voiceGain.connect(masterGain);
    source.start(now);

    currentVoiceSource = source;
    currentVoiceGain = voiceGain;
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
let totalBarsCompleted = 0;  
let totalTrainingBars = 0;   
let targetBpm = 0;
let bpmIncrement = 0;
let barsPerStep = 0;

let bpmHoldInterval = null;
let bpmHoldTimeout = null;
let bpmHoldDirection = 0;

// =====================================
// 🎯 SUBDIVISION DROPDOWN FILTER (모바일 완벽 대응 교정)
// =====================================
function updateSubdivisionOptions() {
    if (!subdivisionInput || !beatsInput) return;

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
            opt.disabled = false; // 👈 모바일 브라우저의 선택 상자 캐시 강제 해제
            if (!firstMatch) firstMatch = opt;
        } else {
            opt.hidden = true;
            opt.style.display = "none";
            opt.disabled = true;  // 👈 보이지 않는 옵션이 손가락에 걸려 선택되는 현상 차단
        }
    });

    // 현재 선택되어 있던 값이 숨겨진 값이라면, 화면에 보이는 첫 번째 옵션으로 자동 변경해 줍니다.
    if (firstMatch && (subdivisionInput.value === "" || subdivisionInput.selectedOptions[0]?.hidden)) {
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

    const counterDiv = document.createElement('div');
    counterDiv.className = 'measure-counter';
    counterDiv.id = 'liveMeasureCounter';
    counterDiv.innerText = "1"; 
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
}

function updateVisualizer() {
    if (!visualizer) return;
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
    const now = audioCtx.currentTime;

    let currentType = type;
    if (type === "human") {
        if (isSubdivision) currentType = "wood"; 
        else return; 
    }

    if (currentType === "shaker") {
        const bufferSize = audioCtx.sampleRate * 0.05; 
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = accent ? 6000 : (isSubdivision ? 8500 : 7500); 

        const gain = audioCtx.createGain();
        const volume = accent ? 0.6 : (isSubdivision ? 0.25 : 0.4); 
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (accent ? 0.045 : 0.035));

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        noise.start(now);
        return; 
    }

    if (currentType === "snare") {
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(accent ? 210 : 160, now); 

        oscGain.gain.setValueAtTime(accent ? 0.6 : 0.4, now);
        oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.connect(oscGain);
        oscGain.connect(masterGain);

        const bufferSize = audioCtx.sampleRate * 0.15;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = isSubdivision ? 1500 : 1000; 

        const noiseGain = audioCtx.createGain();
        const nVol = accent ? 0.45 : (isSubdivision ? 0.15 : 0.3);
        noiseGain.gain.setValueAtTime(nVol, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + (isSubdivision ? 0.06 : 0.12));

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);

        osc.start(now);
        noise.start(now);
        osc.stop(now + 0.15);
        noise.stop(now + 0.15);
        return;
    }

    if (currentType === "cowbell") {
        const baseHz = accent ? 580 : 510; 
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc1.type = "square";
        osc1.frequency.setValueAtTime(baseHz, now);
        osc2.type = "square";
        osc2.frequency.setValueAtTime(baseHz * 1.48, now); 

        filter.type = "bandpass";
        filter.frequency.setValueAtTime(baseHz * 1.55, now);

        const volume = accent ? 0.5 : (isSubdivision ? 0.18 : 0.35);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isSubdivision ? 0.1 : 0.2));

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.25);
        osc2.stop(now + 0.25);
        return;
    }

    if (currentType === "claves") {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = "sine";
        
        let startHz = 2500;
        let endHz = 1200;
        if (accent) {
            startHz = 3500; endHz = 1500;
        } else if (isSubdivision) {
            startHz = 2200; endHz = 1000;
        }

        osc.frequency.setValueAtTime(startHz, now);
        osc.frequency.exponentialRampToValueAtTime(endHz, now + 0.012);

        const volume = accent ? 0.8 : (isSubdivision ? 0.25 : 0.55);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + (isSubdivision ? 0.04 : 0.06));

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.08);
        return;
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    if (currentType === "wood") {
        osc.type = "triangle";
        osc.frequency.value = accent ? 1800 : (isSubdivision ? 800 : 1000);
    } else if (currentType === "click") {
        osc.type = "sine";
        osc.frequency.value = accent ? 1500 : (isSubdivision ? 650 : 800);
    } else { 
        osc.type = "sine";
        osc.frequency.value = accent ? 1000 : (isSubdivision ? 400 : 500);
    }

    const defaultVolume = accent ? 1.0 : (isSubdivision ? 0.3 : 0.6);
    gain.gain.setValueAtTime(defaultVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.05);
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
                trainingInfo.innerHTML = "[ TRAINING MODE ] 🏋️ Training begins! Let's build up the pace";
            } else {
                let progressPercent = 0;
                if (totalTrainingBars > 0) {
                    progressPercent = Math.round((totalBarsCompleted / totalTrainingBars) * 100);
                    if (progressPercent > 100) progressPercent = 100;
                }
                trainingInfo.innerHTML = `[ TRAINING MODE ]  ${progressPercent}%  achieved`;
            }
        } else {
            trainingInfo.innerHTML = "&nbsp;";
        }
    }
}

function tick() {
    const subdivision = Math.ceil(parseFloat(subdivisionInput.value) || 1);

    const currentBeatNumber = Math.floor(currentStep / subdivision) + 1;
    const isSubdivision = (currentStep % subdivision !== 0);
    const accent = accentInput.checked && (currentStep === 0);

    if (soundTypeInput.value === "human") {
        if (!isSubdivision) {
            const voiceIndex = currentBeatNumber <= 9 ? currentBeatNumber : ((currentBeatNumber - 1) % 9) + 1;
            playVoice(voiceIndex);
        } else {
            playClick(false, true);
        }
    } else {
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
            totalBarsCompleted++; 
            
            if (totalBarsCompleted >= totalTrainingBars) {
                setBpm(targetBpm);
                stopMetronome();
                if (trainingInfo) {
                    trainingInfo.style.color = "red";
                    trainingInfo.innerHTML = "[ TRAINING COMPLETE ] 🎉 Target BPM achieved!";
                }
                return;
            }

            if (barsCompleted >= barsPerStep) {
                barsCompleted = 0; 
                currentBar = 0; 
                
                const nextBpm = currentBpm + bpmIncrement;
                if (nextBpm >= targetBpm) {
                    setBpm(targetBpm);
                } else {
                    setBpm(nextBpm);
                }
            }
            
            updateTrainingInfoText(false);
            
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
// MEASURE COUNTER ENGINE
// =====================================
function updateMeasureCounter() {
    const counterElement = document.getElementById('liveMeasureCounter');
    if (!counterElement) return;

    if (trainingEnabled) {
        const maxBars = barsPerStep || 4;
        let currentDisplayBar = (barsCompleted % maxBars) + 1;
        counterElement.innerText = currentDisplayBar;
    } else {
        if (measureInput) {
            const maxMeasures = parseInt(measureInput.value) || 4;
            let currentDisplayBar = (currentBar % maxMeasures) + 1;
            counterElement.innerText = currentDisplayBar;
        }
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
    
    if (currentVoiceSource) {
        try { currentVoiceSource.stop(); } catch(e){}
        currentVoiceSource = null;
        currentVoiceGain = null;
    }

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
        e.preventDefault(); // 모바일 환경 스크롤/확대 버그 제어
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
    totalBarsCompleted = 0; 
    currentBar = 0; 
    
    let startBpm = Math.max(20, rawStart);
    setBpm(startBpm);

    if (targetBpm > startBpm && bpmIncrement > 0) {
        let totalStepsCount = Math.floor((targetBpm - startBpm) / bpmIncrement) + 1;
        totalTrainingBars = totalStepsCount * barsPerStep;
    } else {
        totalTrainingBars = barsPerStep; 
    }
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

// =====================================
// KEYBOARD CONTROLS ENGINE
// =====================================
const activeKeys = new Set();
let keyHoldInterval = null;
let keyHoldTimeout = null;

document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") {
        return;
    }

    if (e.key === "Enter") {
        e.preventDefault();
        if (isRunning) stopMetronome();
        else startMetronome();
        return;
    }

    if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        const tapBtn = document.getElementById("tapBtn");
        if (tapBtn) {
            tapBtn.classList.add("active");
            setTimeout(() => tapBtn.classList.remove("active"), 100);
        }
        tapTempo();
        return;
    }

    let direction = 0;
    switch (e.key) {
        case "ArrowUp":    direction = +1;  break;
        case "ArrowDown":  direction = -1;  break;
        case "ArrowLeft":  direction = -10; break;
        case "ArrowRight": direction = +10; break;
        default: return;
    }

    e.preventDefault();

    if (activeKeys.has(e.key)) return;
    activeKeys.add(e.key);

    setBpm(currentBpm + direction);

    clearTimeout(keyHoldTimeout);
    clearInterval(keyHoldInterval);

    keyHoldTimeout = setTimeout(() => {
        keyHoldInterval = setInterval(() => {
            setBpm(currentBpm + direction);
        }, 80);
    }, 400);
});

document.addEventListener("keyup", (e) => {
    if (activeKeys.has(e.key)) {
        activeKeys.delete(e.key);
        if (keyHoldTimeout) clearTimeout(keyHoldTimeout);
        if (keyHoldInterval) clearInterval(keyHoldInterval);
    }
});

window.addEventListener("blur", () => {
    activeKeys.clear();
    if (keyHoldTimeout) clearTimeout(keyHoldTimeout);
    if (keyHoldInterval) clearInterval(keyHoldInterval);
});