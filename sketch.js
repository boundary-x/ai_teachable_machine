// Bluetooth UUIDs for micro:bit UART service
const UART_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const UART_TX_CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
const UART_RX_CHARACTERISTIC_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

let bluetoothDevice = null;
let rxCharacteristic = null;
let txCharacteristic = null;
let isConnected = false;
let bluetoothStatus = "Disconnected";

// Video and ML variables
let video;
let classifier = null;
let label = "wait";
let isClassifying = false;

// Camera control variables
let isFlipped = false;
let facingMode = "user";
let isVideoLoaded = false; // 비디오 로드 여부 확인

// UI elements
let modelInput, modelSelect, initializeModelButton, stopClassifyButton;
let flipButton, switchCameraButton, connectBluetoothButton, disconnectBluetoothButton;

const modelList = {
  "✌🏻✊🏻🖐🏻 가위 바위 보 분류": "vOi4Y0yiK",
  "🚗 속도 표지판 분류": "cTrp8ZF93",
  "⬅️➡️ 방향 표지판 분류": "ijRgL9IsT"
};

let isSendingData = false;

function setup() {
  // 고정된 캔버스 크기 설정 (400x300)
  let canvas = createCanvas(400, 300);
  canvas.parent('p5-container');
  canvas.style('border-radius', '20px');
  
  // Setup video capture
  setupCamera();

  // Create UI
  createUI();
  
  // 윈도우 리사이즈 이벤트 제거 (고정 크기이므로 필요 없음)
  // window.addEventListener('resize', resizeCanvasToFit); <- 주석 처리
}

function setupCamera() {
  video = createCapture({
    video: {
      facingMode: facingMode,
      width: 400,  // 고정 폭
      height: 300 // 고정 높이
    }
  });
  video.elt.onloadeddata = function() {
    isVideoLoaded = true;
    resizeCanvasToFit(); // 비디오 로드 후 캔버스와 비디오 크기 맞춤
  };
  video.size(400, 300); // 비디오 크기 고정
  video.hide();

  // 비디오 로드가 지연될 경우를 대비해 주기적으로 확인
  let videoLoadCheck = setInterval(() => {
    if (isVideoLoaded) {
      clearInterval(videoLoadCheck);
      return;
    }
    if (video.elt.videoWidth && video.elt.videoHeight) {
      isVideoLoaded = true;
      resizeCanvasToFit();
      clearInterval(videoLoadCheck);
    }
  }, 100);
}

// UI 생성 함수는 변경 없음
function createUI() {
  // Camera control buttons
  flipButton = createButton("↔️ 카메라 좌우 반전");
  flipButton.parent('camera-control-buttons');
  flipButton.style('background', '#78B3FF');
  flipButton.style('color', 'white');
  flipButton.style('border-radius', '12px');
  flipButton.style('padding', '0.8rem');
  flipButton.style('font-size', '1rem');
  flipButton.style('cursor', 'pointer');
  flipButton.mousePressed(toggleFlip);

  switchCameraButton = createButton("🔄 전후방 카메라 전환");
  switchCameraButton.parent('camera-control-buttons');
  switchCameraButton.style('background', '#78B3FF');
  switchCameraButton.style('color', 'white');
  switchCameraButton.style('border-radius', '12px');
  switchCameraButton.style('padding', '0.8rem');
  switchCameraButton.style('font-size', '1rem');
  switchCameraButton.style('cursor', 'pointer');
  switchCameraButton.mousePressed(switchCamera);

  // Bluetooth control buttons
  connectBluetoothButton = createButton("🔗 블루투스 연결");
  connectBluetoothButton.parent('bluetooth-control-buttons');
  connectBluetoothButton.style('background', '#78B3FF');
  connectBluetoothButton.style('color', 'white');
  connectBluetoothButton.style('border-radius', '12px');
  connectBluetoothButton.style('padding', '0.8rem');
  connectBluetoothButton.style('font-size', '1rem');
  connectBluetoothButton.style('cursor', 'pointer');
  connectBluetoothButton.mousePressed(connectBluetooth);

  disconnectBluetoothButton = createButton("❌ 블루투스 연결 해제");
  disconnectBluetoothButton.parent('bluetooth-control-buttons');
  disconnectBluetoothButton.style('background', '#78B3FF');
  disconnectBluetoothButton.style('color', 'white');
  disconnectBluetoothButton.style('border-radius', '12px');
  disconnectBluetoothButton.style('padding', '0.8rem');
  disconnectBluetoothButton.style('font-size', '1rem');
  disconnectBluetoothButton.style('cursor', 'pointer');
  disconnectBluetoothButton.mousePressed(disconnectBluetooth);

  // Model selection
  modelSelect = createSelect();
  modelSelect.parent('model-select-and-link');
  modelSelect.option("모델을 선택하세요", "");
  for (const modelName in modelList) {
    modelSelect.option(modelName, modelList[modelName]);
  }
  modelSelect.changed(updateModelInput);
  modelSelect.style('padding', '0.8rem');
  modelSelect.style('border-radius', '12px');
  modelSelect.style('background', '#ecf0f1');
  modelSelect.style('color', '#2c3e50');

  createA("https://boundaryx.io", "모델 분류 데이터 보기", "_blank")
    .parent('model-select-and-link')
    .style("color", "#78B3FF");

  // Model key input
  modelInput = createInput('');
  modelInput.parent('model-key-container');
  modelInput.style('padding', '0.8rem');
  modelInput.style('border-radius', '12px');
  modelInput.style('background', '#ecf0f1');
  modelInput.style('border', '1px solid #ddd');
  modelInput.style('color', '#2c3e50');

  // Model action buttons
  initializeModelButton = createButton('🟢 모델 로드');
  initializeModelButton.parent('model-action-buttons');
  initializeModelButton.style('background', '#78B3FF');
  initializeModelButton.style('color', 'white');
  initializeModelButton.style('border-radius', '12px');
  initializeModelButton.style('padding', '0.8rem');
  initializeModelButton.style('font-size', '1rem');
  initializeModelButton.style('cursor', 'pointer');
  initializeModelButton.mousePressed(initializeModel);

  stopClassifyButton = createButton('🔴 분류 중지');
  stopClassifyButton.parent('model-action-buttons');
  stopClassifyButton.style('background', '#78B3FF');
  stopClassifyButton.style('color', 'white');
  stopClassifyButton.style('border-radius', '12px');
  stopClassifyButton.style('padding', '0.8rem');
  stopClassifyButton.style('font-size', '1rem');
  stopClassifyButton.style('cursor', 'pointer');
  stopClassifyButton.mousePressed(stopClassification);

  // 초기 블루투스 상태 업데이트
  updateBluetoothStatus();
}

function toggleFlip() {
  isFlipped = !isFlipped;
}

function switchCamera() {
  facingMode = facingMode === "user" ? "environment" : "user";
  video.remove();
  isVideoLoaded = false; // 비디오 로드 상태 초기화
  setupCamera();
}

function updateModelInput() {
  const selectedModelKey = modelSelect.value();
  modelInput.value(selectedModelKey || "");
}

async function connectBluetooth() {
  try {
    console.log("Requesting Bluetooth Device...");
    bluetoothDevice = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: "BBC micro:bit" }],
      optionalServices: [UART_SERVICE_UUID]
    });

    console.log("Connecting to GATT Server...");
    const server = await bluetoothDevice.gatt.connect();

    console.log("Getting UART Service...");
    const service = await server.getPrimaryService(UART_SERVICE_UUID);

    console.log("Getting RX Characteristic...");
    rxCharacteristic = await service.getCharacteristic(UART_RX_CHARACTERISTIC_UUID);

    console.log("Getting TX Characteristic...");
    txCharacteristic = await service.getCharacteristic(UART_TX_CHARACTERISTIC_UUID);

    txCharacteristic.startNotifications();
    txCharacteristic.addEventListener("characteristicvaluechanged", handleReceivedData);

    isConnected = true;
    bluetoothStatus = "Connected to " + bluetoothDevice.name;
  } catch (error) {
    console.error("Bluetooth connection failed:", error);
    bluetoothStatus = "Connection Failed";
  }
  updateBluetoothStatus();
}

function disconnectBluetooth() {
  if (bluetoothDevice && bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
    isConnected = false;
    bluetoothStatus = "Disconnected";
    rxCharacteristic = null;
    txCharacteristic = null;
    bluetoothDevice = null;
  } else {
    bluetoothStatus = "Already Disconnected";
  }
  updateBluetoothStatus();
}

function updateBluetoothStatus() {
  const statusElement = select('#bluetoothStatus');
  statusElement.html(`상태: ${bluetoothStatus}`);
  if (isConnected) {
    statusElement.style('background-color', '#d0f0fd');
    statusElement.style('color', '#FE818D');
  } else {
    statusElement.style('background-color', '#f9f9f9');
    statusElement.style('color', '#FE818D');
  }
}

function handleReceivedData(event) {
  const receivedData = new Uint8Array(event.target.value.buffer);
  const receivedString = new TextDecoder().decode(receivedData);
  console.log("Received:", receivedString);
}

async function sendBluetoothData(data) {
  if (!rxCharacteristic || !isConnected) {
    console.error("Cannot send data: Device not connected.");
    return;
  }

  if (isSendingData) {
    console.log("Waiting for previous data to be sent...");
    return;
  }

  try {
    isSendingData = true;
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data + "\n");
    await rxCharacteristic.writeValue(encodedData);
    console.log("Sent:", data);
  } catch (error) {
    console.error("Error sending data:", error);
  } finally {
    isSendingData = false;
  }
}

function initializeModel() {
  const modelKey = modelInput.value().trim();
  if (!modelKey) {
    alert('모델 키를 입력하세요!');
    return;
  }
  const modelURL = `https://teachablemachine.withgoogle.com/models/${modelKey}/model.json`;
  classifier = ml5.imageClassifier(modelURL, modelLoaded);
}

function modelLoaded() {
  console.log('모델 로드 완료');
  label = "wait";
  startClassification();
}

function startClassification() {
  if (!classifier) {
    console.error('모델이 로드되지 않았습니다.');
    return;
  }
  isClassifying = true;
  classifyVideo();
}

function stopClassification() {
  isClassifying = false;
  label = "stop";
  console.log('모델 분류 정지');
  sendBluetoothData("stop");
}

function classifyVideo() {
  if (!isClassifying) return;
  classifier.classify(video, gotResults);
}

function gotResults(error, results) {
  if (error) {
    console.error("분류 오류:", error);
    return;
  }
  if (results && results.length > 0) {
    label = results[0].label;
    console.log("Classified Label:", label);
    sendBluetoothData(label);
  }
  classifyVideo();
}

function draw() {
  background(220);
  
  // 비디오가 로드되지 않았으면 로딩 메시지 표시
  if (!isVideoLoaded) {
    textAlign(CENTER, CENTER);
    textSize(24);
    fill(255);
    text("카메라 로딩 중...", width / 2, height / 2);
    return;
  }

  if (isFlipped) {
    push();
    translate(width, 0);
    scale(-1, 1);
    image(video, 0, 0, width, height);
    pop();
  } else {
    image(video, 0, 0, width, height);
  }

  // Label 박스
  const boxWidth = width * 0.8;
  const boxHeight = height * 0.18;
  const boxX = (width - boxWidth) / 2;
  const boxY = (height - boxHeight) / 2;
  fill(50, 50, 50, 180);
  noStroke();
  rect(boxX, boxY, boxWidth, boxHeight, 15);
  textSize(height * 0.1);
  textAlign(CENTER, CENTER);
  fill(255);
  text(label, width / 2, height / 2);
}

// 캔버스 크기 고정
function resizeCanvasToFit() {
  resizeCanvas(400, 300);
  video.size(400, 300);
}