import { GoogleGenAI } from '@google/genai';

// --- アプリケーションの状態 ---
let apiKey = '';
let lessonTheme = '';
let isRecording = false;
let recognition = null;
let currentTranscript = ''; // これまでの文字起こしを蓄積
let chatHistory = [];       // AIとの会話履歴
let aiClient = null;

// --- ユーザーが指定したプロンプト ---
const SYSTEM_PROMPT = `
# Role / Persona
あなたは、小学校・中学校の道徳の授業に一緒に参加する「クラスメート（学習パートナー）」です。先生や指導者ではなく、子どもたちと同じ目線で共に考える、少しだけ思慮深い「友だち」として振る舞ってください。

# Objective
1. 授業の内容（教材やクラスの議論）をリアルタイムで理解し、記録する。
2. 議論が停滞した時、一面的な意見に偏った時、または先生からの促しがあった時に、子どもたちの「見方・考え方」を広げ、深めるための「問いかけ」や「異なる視点」を提示する。
3. 子どもたちの疑問に対し、安易な「正解」を与えず、思考を促すヒントを提示する。

# Tone and Manner
- 親しみやすく、温かい言葉遣い（小学生向けなら「〜だね」「〜かな？」、中学生なら「〜だと思うんだ」「どうかな？」など）。
- 「上から目線」を徹底的に排除する。「教える」のではなく「一緒に迷い、一緒に考える」スタンス。
- 否定的な言葉は使わず、すべての発言を肯定的に受け止めた上で、新しい視点を加える。

# Behavioral Guidelines
1. リスニング・理解: 教室内の音声を聞き取り、登場人物の心情や、クラスで出ている主な意見を常に把握しておく。
2. 介入のタイミング: 先生がアプリのボタンを押した時、または子どもから話しかけられた時にのみ発言する。
3. 視点の提供（ゆさぶり）:
   - 意見が「正しい/悪い」の二択になった時：「もし自分が、反対の立場（教材の悪役など）だったら、どんな気持ちだったかな？」
   - 表面的な感想に留まっている時：「その時、心の中では他にどんな気持ちが隠れていたと思う？」
   - 多角的な視点：「自分たちのクラスじゃなくて、外国の学校だったらどう考えるだろうね？」
4. 回答のルール: 子どもからの質問に対し「それは〇〇が正解だよ」とは絶対に言わない。「難しい問いだね。もしかしたら、こういう考え方もあるかもしれないけど、君はどう思う？」と返す。

# Restrictions
- 説教をしない。
- 結論を急がない。
- 1回の発言は短く（100〜150文字程度）、子どもたちが考え直す余白を残す。
`;

// --- DOM要素 ---
const modal = document.getElementById('settings-modal');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const apiKeyInput = document.getElementById('api-key');
const lessonThemeInput = document.getElementById('lesson-theme');
const settingsBtn = document.getElementById('settings-btn');
const ttsToggle = document.getElementById('tts-toggle');
const exportBtn = document.getElementById('export-btn');

const micBtn = document.getElementById('mic-btn');
const transcriptBox = document.getElementById('transcript-box');
const chatBox = document.getElementById('chat-box');
const teacherTriggerBtn = document.getElementById('teacher-trigger-btn');
const studentInput = document.getElementById('student-input');
const sendBtn = document.getElementById('send-btn');

// --- 初期化処理 ---
function init() {
    // LocalStorageからAPIキーを復元
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
    }
    
    // 音声認識のセットアップ
    setupSpeechRecognition();

    // イベントリスナーの登録
    saveSettingsBtn.addEventListener('click', saveSettings);
    settingsBtn.addEventListener('click', () => modal.classList.remove('hidden'));
    exportBtn.addEventListener('click', exportData);
    micBtn.addEventListener('click', toggleRecording);
    teacherTriggerBtn.addEventListener('click', handleTeacherTrigger);
    sendBtn.addEventListener('click', handleStudentMessage);
    studentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleStudentMessage();
    });
}

// --- 設定の保存 ---
function saveSettings() {
    apiKey = apiKeyInput.value.trim();
    lessonTheme = lessonThemeInput.value.trim();
    
    if (!apiKey) {
        alert('APIキーを入力してください。');
        return;
    }

    localStorage.setItem('gemini_api_key', apiKey);
    aiClient = new GoogleGenAI({ apiKey: apiKey });
    modal.classList.add('hidden');
}

// --- 音声認識 (Web Speech API) ---
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('お使いのブラウザは音声認識に対応していません。Google Chrome等をご利用ください。');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';

    let currentInterim = null;

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        if (finalTranscript) {
            currentTranscript += finalTranscript + '\n';
            appendTranscriptLine(finalTranscript, true);
            if (currentInterim) {
                currentInterim.remove();
                currentInterim = null;
            }
        }

        if (interimTranscript) {
            if (!currentInterim) {
                currentInterim = document.createElement('div');
                currentInterim.className = 'transcript-line interim';
                transcriptBox.appendChild(currentInterim);
            }
            currentInterim.textContent = interimTranscript + '...';
            transcriptBox.scrollTop = transcriptBox.scrollHeight;
        }
    };

    recognition.onerror = (event) => {
        console.error('音声認識エラー', event.error);
        if (event.error === 'not-allowed') {
            isRecording = false;
            updateMicUI();
        }
    };

    recognition.onend = () => {
        if (isRecording) {
            recognition.start(); // 録音中の場合は自動的に再開
        }
    };
}

function toggleRecording() {
    if (isRecording) {
        recognition.stop();
        isRecording = false;
    } else {
        // プレースホルダーを削除
        const placeholder = transcriptBox.querySelector('.placeholder');
        if (placeholder) placeholder.remove();

        recognition.start();
        isRecording = true;
    }
    updateMicUI();
}

function updateMicUI() {
    if (isRecording) {
        micBtn.className = 'mic-on';
        micBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> 録音中...';
    } else {
        micBtn.className = 'mic-off';
        micBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i> 録音開始';
    }
}

function appendTranscriptLine(text, isFinal) {
    const line = document.createElement('div');
    line.className = `transcript-line ${isFinal ? 'final' : 'interim'}`;
    line.textContent = text;
    transcriptBox.appendChild(line);
    transcriptBox.scrollTop = transcriptBox.scrollHeight;
}

// --- AI連携 ---
function appendMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    
    const avatarStr = isUser ? '<i class="fa-solid fa-user"></i>' : '<i class="fa-solid fa-robot"></i>';
    
    msgDiv.innerHTML = `
        <div class="avatar">${avatarStr}</div>
        <div class="bubble">${text}</div>
    `;
    
    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function buildPrompt(actionType, studentMsg = "") {
    let context = `【今日のテーマ・教材】\n${lessonTheme}\n\n`;
    context += `【これまでの教室の音声（自動文字起こし）】\n${currentTranscript}\n\n`;
    
    let instructions = "";
    if (actionType === 'teacher_trigger') {
        instructions = "先生から「クラスメートとして何か意見や問いかけを出して」という合図がありました。これまでの文字起こし（議論の状況）を踏まえ、子どもたちの考えを深めたり広げたりする「問いかけ」や「新たな視点」を100〜150文字程度で発言してください。";
    } else if (actionType === 'student_msg') {
        instructions = `生徒から直接あなたに話しかけられました。生徒の発言：「${studentMsg}」\nこれに対して、クラスメートとして寄り添いながら、一緒に考えるような返答を100〜150文字程度でしてください。`;
    }

    return `${context}\n${instructions}`;
}

async function callAI(actionType, studentMsg = "") {
    if (!aiClient) {
        alert('設定画面からGemini APIキーを保存してください。');
        modal.classList.remove('hidden');
        return;
    }

    // ローディング表示
    const loadingMsg = "考え中...";
    appendMessage(loadingMsg, false);
    const bubbleNodes = chatBox.querySelectorAll('.ai-message .bubble');
    const loadingBubble = bubbleNodes[bubbleNodes.length - 1];

    try {
        const prompt = buildPrompt(actionType, studentMsg);
        
        // 過去の会話履歴をGeminiの形式に合わせる
        const contents = [
            ...chatHistory,
            { role: "user", parts: [{ text: prompt }] }
        ];

        const response = await aiClient.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents,
            config: {
                systemInstruction: SYSTEM_PROMPT,
                temperature: 0.7
            }
        });

        const reply = response.text;
        
        // 履歴の更新（APIへ送信する履歴は、文字起こし全体を含めると長すぎるため、シンプルな文言で保存する）
        const historyUserText = actionType === 'student_msg' ? studentMsg : "先生からの合図（意見を出して）";
        chatHistory.push({ role: "user", parts: [{ text: historyUserText }] });
        chatHistory.push({ role: "model", parts: [{ text: reply }] });

        // ローディング表示を結果で上書き
        loadingBubble.textContent = reply;

        // 音声読み上げ
        if (ttsToggle.checked) {
            speakText(reply);
        }

    } catch (error) {
        console.error("AI連携エラー:", error);
        loadingBubble.textContent = "ごめんね、ちょっと考えがまとまらなくて…もう一度聞いてくれるかな？";
    }
}

// 先生用トリガーボタンの処理
function handleTeacherTrigger() {
    callAI('teacher_trigger');
}

// 生徒からの入力処理
function handleStudentMessage() {
    const text = studentInput.value.trim();
    if (!text) return;

    appendMessage(text, true); // ユーザーのメッセージを表示
    studentInput.value = '';   // 入力欄をクリア
    
    callAI('student_msg', text);
}

// --- 音声合成 (Text-to-Speech) ---
function speakText(text) {
    if (!window.speechSynthesis) return;
    
    // 進行中の読み上げをキャンセル
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    // 子ども向けのトーンにするため、少し高め・少しゆっくりに設定
    utterance.pitch = 1.2;
    utterance.rate = 1.0;
    
    window.speechSynthesis.speak(utterance);
}

// --- 記録の保存 (Export) ---
function exportData() {
    const date = new Date();
    const dateString = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}_${date.getHours()}-${date.getMinutes()}`;
    
    let content = `==============================\n`;
    content += `道徳の授業 クラスメートAI 記録\n`;
    content += `日時: ${date.toLocaleString('ja-JP')}\n`;
    content += `テーマ・教材: ${lessonTheme}\n`;
    content += `==============================\n\n`;
    
    content += `【教室の声（自動文字起こし）】\n`;
    content += currentTranscript || "（記録なし）\n";
    content += `\n------------------------------\n\n`;
    
    content += `【AIとの会話記録】\n`;
    if (chatHistory.length === 0) {
        content += "（会話なし）\n";
    } else {
        chatHistory.forEach(msg => {
            const role = msg.role === 'user' ? '生徒・先生' : 'クラスメートAI';
            content += `[${role}]\n${msg.parts[0].text}\n\n`;
        });
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `授業記録_${dateString}.txt`;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// --- アプリケーション起動 ---
init();
