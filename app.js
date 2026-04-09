// --- Googly Eye Logo (cursor-following) ---
(function initGooglyLogo() {
    const canvas = document.getElementById('googlyLogo');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const eyes = [
        { cx: 32, cy: 48, r: 26, pupilR: 12 },
        { cx: 72, cy: 44, r: 28, pupilR: 13 }
    ];

    let mouseX = W / 2;
    let mouseY = H / 2;

    document.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });

    function draw() {
        ctx.clearRect(0, 0, W, H);

        for (const eye of eyes) {
            // White of eye
            ctx.beginPath();
            ctx.arc(eye.cx, eye.cy, eye.r, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Calculate pupil position toward cursor
            const dx = mouseX - eye.cx;
            const dy = mouseY - eye.cy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = eye.r - eye.pupilR - 2;
            const clampedDist = Math.min(dist, maxDist);
            const angle = Math.atan2(dy, dx);
            const px = eye.cx + Math.cos(angle) * clampedDist;
            const py = eye.cy + Math.sin(angle) * clampedDist;

            // Pupil
            ctx.beginPath();
            ctx.arc(px, py, eye.pupilR, 0, Math.PI * 2);
            ctx.fillStyle = '#111';
            ctx.fill();

            // Shine
            ctx.beginPath();
            ctx.arc(px - 3, py - 4, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fill();
        }

        requestAnimationFrame(draw);
    }

    draw();
})();

const apiKeyInput = document.getElementById('apiKey');
const toggleKeyBtn = document.getElementById('toggleKey');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewSection = document.getElementById('previewSection');
const originalImage = document.getElementById('originalImage');
const resultImage = document.getElementById('resultImage');
const resultContainer = document.getElementById('resultContainer');
const loading = document.getElementById('loading');
const googlyBtn = document.getElementById('googlyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const errorMessage = document.getElementById('errorMessage');

let currentFile = null;
let currentBase64 = null;

// --- API Key toggle ---
toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleKeyBtn.textContent = isPassword ? '🙈' : '👁️';
});

// Persist API key in localStorage
apiKeyInput.addEventListener('input', () => {
    localStorage.setItem('geminiApiKey', apiKeyInput.value);
});

const savedKey = localStorage.getItem('geminiApiKey');
if (savedKey) apiKeyInput.value = savedKey;

// --- Drag & Drop ---
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        handleFile(file);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) handleFile(e.target.files[0]);
});

function handleFile(file) {
    currentFile = file;
    hideError();

    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        currentBase64 = dataUrl.split(',')[1];
        originalImage.src = dataUrl;
        previewSection.classList.remove('hidden');
        resultImage.classList.add('hidden');
        downloadBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');
        loading.classList.add('hidden');
        resultContainer.style.background = '#111';
        googlyBtn.classList.remove('hidden');
        googlyBtn.disabled = false;
    };
    reader.readAsDataURL(file);
}

// --- Googly-fy ---
googlyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showError('You need an API key first! Grab a free one from aistudio.google.com/apikey');
        return;
    }
    if (!currentBase64) {
        showError('Upload an image first — give us something to googly-fy!');
        return;
    }

    googlyBtn.disabled = true;
    loading.classList.remove('hidden');
    resultImage.classList.add('hidden');
    downloadBtn.classList.add('hidden');
    resetBtn.classList.add('hidden');
    hideError();

    try {
        const result = await googlyFy(apiKey, currentBase64, currentFile.type);
        resultImage.src = `data:image/png;base64,${result}`;
        resultImage.classList.remove('hidden');
        resultContainer.style.background = 'transparent';
        downloadBtn.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
        googlyBtn.classList.add('hidden');
    } catch (err) {
        showError(err.message);
        googlyBtn.disabled = false;
    } finally {
        loading.classList.add('hidden');
    }
});

async function googlyFy(apiKey, base64Image, mimeType) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`;

    const prompt = `Edit this image to add large, comical, white googly eyes with black pupils to EVERY object, person, animal, or thing in the image. The googly eyes should look like classic craft googly eyes — white circles with a smaller black circle inside that looks like it could wobble. Make the eyes cartoonishly large and slightly different sizes for extra comedy. Every single thing that could conceivably have eyes should get them — people, animals, food, furniture, buildings, clouds, everything. The rest of the image should remain completely unchanged. Return ONLY the edited image.`;

    const body = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: mimeType || 'image/jpeg',
                        data: base64Image
                    }
                }
            ]
        }],
        generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 1.0
        }
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const msg = err?.error?.message || `API error: ${response.status}`;
        if (response.status === 400 && msg.includes('API_KEY')) {
            throw new Error('Invalid API key. Double-check it at aistudio.google.com/apikey');
        }
        throw new Error(msg);
    }

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts;

    if (!parts) {
        throw new Error('Gemini returned an empty response. The image might be too spicy for the content filter.');
    }

    const imagePart = parts.find(p => p.inlineData);
    if (!imagePart) {
        const textPart = parts.find(p => p.text);
        throw new Error(textPart?.text || 'No image was returned. Gemini might be having an off day — try again!');
    }

    return imagePart.inlineData.data;
}

// --- Download ---
downloadBtn.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `googly_${currentFile?.name || 'masterpiece.png'}`;
    link.href = resultImage.src;
    link.click();
});

// --- Reset ---
resetBtn.addEventListener('click', () => {
    currentFile = null;
    currentBase64 = null;
    fileInput.value = '';
    previewSection.classList.add('hidden');
    hideError();
});

// --- Error helpers ---
function showError(msg) {
    errorMessage.textContent = msg;
    errorMessage.classList.remove('hidden');
}

function hideError() {
    errorMessage.classList.add('hidden');
}
