const ROWS = 12;
const COLS = 6;
const TYPES = 5; // 晴れ1, 雨2, 曇り3, 雪4, 雷5
const ICONS = { 1: '☀️', 2: '☔', 3: '☁️', 4: '⛄', 5: '⚡' };

let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let nextPuyoData = [randomType(), randomType()];
let activePuyo = null;
let gameStatus = 'menu'; // menu, playing, falling, quiz, gameover
let dropIntervalId = null;
let score = 0;
let chainCount = 0;
let currentDropRate = 800; // ms per drop
let playerName = "ゲスト";
let nextQuizThreshold = 1000;
let questionsRemaining = 0;
let correctAnswersCount = 0;

const boardEl = document.getElementById('game-board');
const nextBoardEl = document.getElementById('next-puyo-board');
const scoreEl = document.getElementById('score');
const chainEl = document.getElementById('chain-counter');

// クイズデータ (小学5年生 理科 「天気の変化」を中心に50問)
const QUIZZES = [
    { q: "天気はふつう、どの方角からどの方角へ変わっていく？", c: ["西から東", "東から西", "北から南", "南から北"], a: 0, exp: "日本の上空には「偏西風」という西から東へ向かう風が吹いており、天気も西から東へと変化していくことが多いんだよ。" },
    { q: "雲は主に何からできている？", c: ["水や氷のつぶ", "煙（けむり）", "わた", "空気のあぶく"], a: 0, exp: "空気にふくまれる水蒸気が冷やされて「小さな水や氷のつぶ」になったのが雲の正体だよ。" },
    { q: "空全体の9割が雲でおおわれている時の天気は？", c: ["くもり", "はれ", "雨", "快晴"], a: 0, exp: "空全体の雲の量が9割〜10割だと「くもり」、2割〜8割なら「はれ」、0〜1割なら「快晴」だよ。" },
    { q: "はれの天気は、空全体の何割まで雲があってもいい？", c: ["8割", "5割", "3割", "1割"], a: 0, exp: "雲の量が2割〜8割までなら「はれ」になるんだ。意外と雲が多くても「はれ」なんだね！" },
    { q: "アメダスが自動で観測していないものはどれ？", c: ["雷の回数", "降水量（雨の量）", "気温・風速", "日照時間"], a: 0, exp: "アメダスは雨・気温・風向・風速・日照時間などを観測しているけど、雷の回数は対象にしていないよ。" },
    { q: "日本の夏の天気の特徴として正しいものは？", c: ["むし暑い", "空気がかんそうしている", "気温が低く雨が降らない"], a: 0, exp: "太平洋側から吹く南東の風の影響で、夏の日本は気温が高く、湿り気があって「むし暑い」のが特徴だよ。" },
    { q: "台風が日本に近づく前に、特によく進む方角は？", c: ["北の方角", "南の方角", "西から東の固定"], a: 0, exp: "台風は南の暖かい海で発生し、最初は北や北西の方へ進んでから、日本付近で東へ曲がることが多いよ。" },
    { q: "降水確率100%のとき、必ず起こることは？", c: ["1ミリ以上の雨か雪が降る", "必ず大雨になる", "1日中ずっと雨が降る"], a: 0, exp: "降水確率100%は「必ず1ミリ以上降る確率」のこと。大雨や1日中降るとは限らないよ。" },
    { q: "同じ場所で雨が降り続けると、どうなる可能性がある？", c: ["川がはんらんする", "天気が西へ移動する", "すぐに晴れる"], a: 0, exp: "大雨が降り続くと、川の水があふれたり（はんらん）、がけ崩れが起きたりする危険があるよ！" },
    { q: "日本の冬の天気の特徴で、日本海側の天気はどうなりやすい？", c: ["雪や雨が多い", "ずっと晴れている", "とても暖かい"], a: 0, exp: "北西の冷たい風が日本海の水蒸気を含んで山にぶつかり、雪や雨を降らせるんだ。" },
    { q: "空全体の雲の量が「1割」のとき、天気は何になる？", c: ["快晴（かいせい）", "はれ", "くもり", "雨"], a: 0, exp: "雲の量が0〜1割の間は、はれよりもっと晴れている「快晴（かいせい）」と呼ぶよ。" },
    { q: "雲のもとになる水蒸気は、主にどこからやってくる？", c: ["海や川などから蒸発した水", "宇宙からのガス", "飛行機のけむり"], a: 0, exp: "海や川などの水が太陽にあたって温められ、水蒸気になって空へのぼっていくんだ。" },
    { q: "天気予報で「明日は晴れのち曇り」の「のち」の意味は？", c: ["順番に天気が変わる", "時間帯によって場所が変わる", "晴れと曇りが混ざっている"], a: 0, exp: "「のち」は、時間がたつと天気がそちらに変わるという意味だよ。" },
    { q: "天気予報で「明日は晴れ時々曇り」の「時々」の意味は？", c: ["晴れの時間が長いが、たまに曇る", "晴れと曇りが1時間ごとに入れかわる", "午後からずっと曇る"], a: 0, exp: "「時々」は、ずっとではないけれど、とぎれとぎれにその天気が現れるという意味だよ。" },
    { q: "アメダスは日本全国に約何キロメートルの間隔で置かれている？", c: ["約20km", "約5km", "約100km"], a: 0, exp: "地域気象観測システム「アメダス」は、全国に約1300か所、およそ17〜21kmの間隔で置かれているよ。" },
    { q: "宇宙から日本のまわりの雲の様子を観察している気象衛星の名前は？", c: ["ひまわり", "さくら", "はやぶさ"], a: 0, exp: "気象衛星「ひまわり」は、地球から約3万6千kmの上空から雲のようすを観察しているよ。" },
    { q: "春や秋の天気は、どのように変わりやすい？", c: ["晴れと雨が数日おきに交互にくる", "毎日ずっと雨が降る", "一ヶ月同じ天気が続く"], a: 0, exp: "春と秋は、晴れをもたらす高気圧と、雨をもたらす低気圧が西から交互にやってくるからだよ。" },
    { q: "台風のもとになる「熱帯低気圧」はどこで生まれる？", c: ["南のあたたかい海", "北のつめたい海", "日本の山の中", "砂漠"], a: 0, exp: "熱帯低気圧（台風）は、赤道付近のあたたかい海水から立ちのぼる大量の水蒸気から生まれるよ。" },
    { q: "昔からの言い伝え（観天望気）で「ツバメが低く飛ぶ」とどうなると言われる？", c: ["雨になる", "晴れる", "雪が降る", "台風が来る"], a: 0, exp: "湿度が高くなると羽が重くなったりえさの虫が低く飛んだりするため、雨が近いサインとされるよ。" },
    { q: "「夕焼け」が見えた次の日の天気はどうなりやすい？", c: ["晴れ", "雨", "雪", "雷"], a: 0, exp: "夕焼けが見えるということは西の空が晴れている証拠。天気は西から東へ変わるので明日は晴れやすいよ。" },
    { q: "「朝焼け」が見えた日の天気はどうなりやすい？", c: ["雨", "晴れ", "雪", "雷"], a: 0, exp: "朝焼けは東の空が晴れている証拠だけど、西側には雲が近づいていることが多いので、雨になりやすいよ。" },
    { q: "星がチカチカまたたいている夜、翌日の天気はどうなりやすい？", c: ["風が強くなる", "雨が降る", "雷が落ちる"], a: 0, exp: "上空の風が強く吹いていると空気が乱れて星がチカチカ見えるから、地上も風が強くなりやすいよ。" },
    { q: "台風の中心にある、風が弱く雲がない部分を何という？", c: ["台風の目", "台風の心臓", "オアシス"], a: 0, exp: "台風の中心の「目」に入ると、急に風が弱まり青空が見えることもあるけれど、すぐにまた暴風になるよ。" },
    { q: "降水量（雨の量）をはかる機械の名前は？", c: ["雨量計（うりょうけい）", "温度計（おんどけい）", "風向風速計"], a: 0, exp: "雨量計（うりょうけい）という筒のような機械に雨をためて、何ミリ降ったかを測るんだ。" },
    { q: "夏の日本にふく、あたたかく湿った風はどこから来る？", c: ["南東の海（太平洋）", "北西のシベリア", "西の砂漠"], a: 0, exp: "太平洋高気圧という大きな空気の固まりから、南東のしめった暖かい風が吹いてくるよ。" },
    { q: "冬の日本にふく、つれたく乾燥した風はどこから来る？", c: ["北西の大陸（シベリア方面）", "南の海", "東の海"], a: 0, exp: "シベリアの高気圧から吹く冷たい『北西の季節風』が冬の日本の天気を決めているよ。" },
    { q: "温度計で正しい気温をはかるとき、地面からどのくらいの高さにする？", c: ["約1.2〜1.5m", "約10m", "地面にぴったりくっつける"], a: 0, exp: "地面の熱のえいきょうを受けないように、大人の胸の高さくらいの風通しの良い日陰で測るのが正しいよ。" },
    { q: "正しい温度計の使い方で【まちがっている】のはどれ？", c: ["直射日光に当てる", "雨や雪が当たらないようにする", "風通しをよくする", "百葉箱に入れる"], a: 0, exp: "太陽の光（直射日光）に当てると、温度計そのものが熱くなってしまい正しい気温が測れないよ！" },
    { q: "気象衛星ひまわりの画像で、白くモクモクとうつっているのは何？", c: ["雲", "海", "森", "雪"], a: 0, exp: "ひまわりの画像では、雲が白く写っているよ。これをもとに天気の変化を予想しているんだ。" },
    { q: "台風が近づくと、海で海面が高く盛り上がる危険な現象は何？", c: ["高潮（たかしお）", "洪水（こうずい）", "がけ崩れ"], a: 0, exp: "気圧が低くて海の水が吸い上げられたり、強い風で波がふき寄せられたりして、海面が高くなるよ。" },
    { q: "台風と呼ばれるのは、最大風速が約何メートル（毎秒）を超えたとき？", c: ["約17メートル", "約5メートル", "約100メートル"], a: 0, exp: "熱帯低気圧のうち、中心の最大風速が17.2m/sを超えたものが「台風」と呼ばれるよ。" },
    { q: "春に吹く、その年初めての強い南風を何という？", c: ["春一番", "木枯らし", "つむじ風"], a: 0, exp: "冬が終わって春が近づくと、暖かくて強い南風「春一番」が吹くことがあるよ。" },
    { q: "5月から7月ごろにかけて、日本に雨をたくさん降らせる前線は？", c: ["梅雨前線（ばいうぜんせん）", "秋雨前線", "寒冷前線"], a: 0, exp: "北の冷たい空気と南の暖かい空気がぶつかってできる「梅雨前線」が、長い雨（つゆ）を降らせるよ。" },
    { q: "天気図によく書かれている「hPa（ヘクトパスカル）」は何の単位？", c: ["気圧（空気の重さ）", "気温の高さ", "雨の強さ", "風のスピード"], a: 0, exp: "ヘクトパスカルは気圧の単位だよ。数字がまわりより低いところが「低気圧」だよ。" },
    { q: "夏の夕方に、急に空が暗くなってはげしく降る雨を何という？", c: ["夕立（ゆうだち）", "ひょう", "霧雨（きりさめ）"], a: 0, exp: "地面が強く熱せられて急に大きな入道雲（積乱雲）ができ、夕立ちやゲリラ豪雨を降らせるよ。" },
    { q: "冬によく起こる、山の斜面などで雪が突然すべり落ちる災害は？", c: ["なだれ", "地割れ", "竜巻（たつまき）"], a: 0, exp: "たくさん雪が積もった山や、春になって少し暖かくなったころには「雪崩（なだれ）」が起きやすいから注意が必要だよ。" },
    { q: "山の天気が変わりやすいと言われる理由は？", c: ["風が山にぶつかって雲ができやすいから", "山には太陽が当たらないから", "空に近いから"], a: 0, exp: "湿った風が山にぶつかって上に押し上げられると、急に空気が冷えて雲を作り、雨が降りやすくなるんだ。" },
    { q: "川の水が増えすぎて、堤防（ていぼう）をこえてあふれ出すことを何という？", c: ["洪水（こうずい）・はんらん", "土砂崩れ", "干ばつ"], a: 0, exp: "大雨や長雨が続くと川の水位があがり、洪水やはんらんが起きて家などが水にひたる危険があるよ。" },
    { q: "霧（きり）と雲のちがいは何？", c: ["地面にくっついているか空にあるか", "できている成分", "重さの違い"], a: 0, exp: "霧も雲も同じ「細かい水滴」だよ。空の高いところにあるのが雲、地面の近くにあるのが霧と呼ばれるだけなんだ。" },
    { q: "気象庁が発表する「注意報」と「警報」で、より危険なのはどっち？", c: ["警報（けいほう）", "注意報（ちゅういほう）", "どちらも同じ"], a: 0, exp: "災害が起こるおそれがあるのが「注意報」、重大な災害が起こる危険性が高いのが「警報」だよ。" },
    { q: "警報よりもさらに危険な「特別警報」が出たときはどうすればいい？", c: ["ただちに命を守るための行動をとる", "急いで外へ様子を見に行く", "家の窓を開ける"], a: 0, exp: "数十年に一度にしかないようなとっても危険な状況だよ！すぐに命を守る行動が必要なんだ。" },
    { q: "飛行機がとぶような高い空の温度は、地上と比べてどうなっている？", c: ["とても冷たい（マイナス何十度）", "とても暑い", "地上と同じ"], a: 0, exp: "空の上はとても冷たく、だから水蒸気が氷の粒になって雲ができたりするんだよ。" },
    { q: "雷が鳴っているとき、安全な場所はどこ？", c: ["しっかりした建物や車の中", "大きな木の下", "何もない広いグラウンド"], a: 0, exp: "木の下や広い場所は雷が落ちやすくてとっても危険！鉄筋コンクリートの建物や、実は車の中が安全なんだ。" },
    { q: "雲がきれいに晴れた夜から朝にかけて、熱が逃げて急に冷え込むことを何という？", c: ["放射冷却（ほうしゃれいきゃく）", "地球温暖化", "冷帯気候"], a: 0, exp: "雲がないと、地面の熱が宇宙へ逃げていってしまうため、朝方にとても寒くなるよ（放射冷却）。" },
    { q: "にじは、太陽の光が雨つぶに当たって分かれることで見えます。一番下の色は何色？", c: ["むらさき色", "赤色", "緑色"], a: 0, exp: "にじの色は上から順番に 赤・だいだい・黄・緑・青・あい・紫 と並んでいるよ。" },
    { q: "にじの一番上の色は何色？", c: ["赤色", "むらさき色", "青色"], a: 0, exp: "にじの一番外側（上）は赤色、一番内側（下）は紫色になっているよ。" },
    { q: "天気図に書かれている、気圧が同じところを結んだ線を何という？", c: ["等圧線（とうあつせん）", "等高線（とうこうせん）", "気圧線"], a: 0, exp: "等圧線の間隔がせまいところは、気圧の坂道が急になっているので、強い風が吹いているよ。" },
    { q: "高気圧の中心は、まわりより気圧がどうなっている？", c: ["高い", "低い", "同じ"], a: 0, exp: "まわりよりも気圧が高いところを「高気圧」と呼び、中心からは空気が外へ向かって吹き出しているよ。" },
    { q: "低気圧の中心は、まわりより気圧がどうなっている？", c: ["低い", "高い", "同じ"], a: 0, exp: "低気圧のまわりからは空気が中心へ向かって集まり、その空気が上に昇る（上昇気流）ため雲ができやすいんだ。" },
    { q: "百葉箱（ひゃくようばこ）の中が白くぬられているのはなぜ？", c: ["太陽の光をはね返すため", "暗いと見えないから", "虫が寄ってこないように"], a: 0, exp: "日光の熱を吸収しないように、風通し用のよろい戸が白くぬられているんだよ。" }
];

function randomType() { return Math.floor(Math.random() * TYPES) + 1; }

function startGame() {
    if (!playerName) playerName = "ゲスト";
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    chainCount = 0;
    currentDropRate = 800;
    nextQuizThreshold = 1000;
    updateScoreUI();
    document.getElementById('name-modal').classList.add('hidden');
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('overlay').classList.add('hidden');
    gameStatus = 'playing';
    spawnPuyo();
    if (dropIntervalId) clearInterval(dropIntervalId);
    dropIntervalId = setInterval(gameStep, currentDropRate);
}

function updateSpeed() {
    // 500点ごとにスピードアップ（最速150ms）
    let newRate = Math.max(150, 800 - Math.floor(score / 500) * 60);
    if (newRate !== currentDropRate && dropIntervalId) {
        currentDropRate = newRate;
        clearInterval(dropIntervalId);
        dropIntervalId = setInterval(gameStep, currentDropRate);
    }
}

function spawnPuyo() {
    activePuyo = {
        r: 1, c: 2, t1: nextPuyoData[0], // pivot (bottom)
        r2: 0, c2: 2, t2: nextPuyoData[1], // partner (top)
        rot: 0 // 0: partner is above, 1: right, 2: below, 3: left
    };
    
    // next update
    nextPuyoData = [randomType(), randomType()];
    renderNext();
    
    // 湧きつぶし判定
    if (grid[1][2] !== 0 || grid[0][2] !== 0) {
        gameOver();
        return;
    }
    renderFrame();
}

function renderNext() {
    nextBoardEl.innerHTML = `
        <div class="puyo" style="top: calc(var(--grid-size) * 0.2); left: calc(var(--grid-size) * 0.5);" data-type="${nextPuyoData[1]}" data-icon="${ICONS[nextPuyoData[1]]}"></div>
        <div class="puyo" style="top: calc(var(--grid-size) * 1.4); left: calc(var(--grid-size) * 0.5);" data-type="${nextPuyoData[0]}" data-icon="${ICONS[nextPuyoData[0]]}"></div>
    `;
}

function renderFrame(vanishing = []) {
    boardEl.innerHTML = '';
    // Draw Grid
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== 0) {
                let el = document.createElement('div');
                el.className = 'puyo';
                el.dataset.type = grid[r][c];
                el.dataset.icon = ICONS[grid[r][c]];
                el.style.top = `calc(${r} * var(--grid-size))`;
                el.style.left = `calc(${c} * var(--grid-size))`;
                
                // vanishing animation class
                if (vanishing.some(v => v.r === r && v.c === c)) {
                    el.classList.add('puyo-vanishing');
                }
                boardEl.appendChild(el);
            }
        }
    }
    
    // Draw Active
    if (activePuyo && gameStatus === 'playing') {
        let p1 = document.createElement('div');
        p1.className = 'puyo falling';
        p1.dataset.type = activePuyo.t1; p1.dataset.icon = ICONS[activePuyo.t1];
        p1.style.top = `calc(${activePuyo.r} * var(--grid-size))`; p1.style.left = `calc(${activePuyo.c} * var(--grid-size))`;
        
        let p2 = document.createElement('div');
        p2.className = 'puyo falling';
        p2.dataset.type = activePuyo.t2; p2.dataset.icon = ICONS[activePuyo.t2];
        p2.style.top = `calc(${activePuyo.r2} * var(--grid-size))`; p2.style.left = `calc(${activePuyo.c2} * var(--grid-size))`;
        
        boardEl.appendChild(p1);
        boardEl.appendChild(p2);
    }
}

function canMove(r1, c1, r2, c2) {
    if (r1 < 0 || r1 >= ROWS || c1 < 0 || c1 >= COLS || r2 < 0 || r2 >= ROWS || c2 < 0 || c2 >= COLS) return false;
    if (grid[r1][c1] !== 0 || grid[r2][c2] !== 0) return false;
    return true;
}

function gameStep() {
    if (gameStatus !== 'playing') return;
    
    if (canMove(activePuyo.r + 1, activePuyo.c, activePuyo.r2 + 1, activePuyo.c2)) {
        activePuyo.r++;
        activePuyo.r2++;
        renderFrame();
    } else {
        lockPuyo();
    }
}

function lockPuyo() {
    gameStatus = 'falling'; // locking phase
    grid[activePuyo.r][activePuyo.c] = activePuyo.t1;
    grid[activePuyo.r2][activePuyo.c2] = activePuyo.t2;
    activePuyo = null;
    
    // apply partial gravity if partner was placed above empty space due to rotation locking
    if (applyGravity()) {
        renderFrame();
        setTimeout(resolveMatches, 300);
    } else {
        resolveMatches();
    }
}

function applyGravity() {
    let moved = false;
    for (let c = 0; c < COLS; c++) {
        let emptyRow = ROWS - 1;
        for (let r = ROWS - 1; r >= 0; r--) {
            if (grid[r][c] !== 0) {
                if (r !== emptyRow) {
                    grid[emptyRow][c] = grid[r][c];
                    grid[r][c] = 0;
                    moved = true;
                }
                emptyRow--;
            }
        }
    }
    return moved;
}

function resolveMatches() {
    renderFrame();
    const groups = findMatches();
    if (groups.length > 0) {
        chainCount++;
        if (chainCount > 1) {
            chainEl.textContent = `${chainCount} 連鎖！`;
            chainEl.classList.remove('hidden');
        }
        
        let flatMatches = [];
        let stepScore = 0;
        
        // グループごとに基本点と個数ボーナスを計算
        groups.forEach(g => {
            flatMatches.push(...g);
            // 4つ消したら100点、5つで110点、6つで120点...
            let base = 100 + Math.max(0, g.length - 4) * 10;
            stepScore += base;
        });
        
        // 2列同時に消したらコンボボーナス（同時消し）追加
        if (groups.length > 1) {
            stepScore += (groups.length - 1) * 100;
        }
        
        // 連鎖による倍率（ぷよぷよの醍醐味として連鎖数で掛ける）
        score += stepScore * chainCount;
        
        // Add delete animation
        renderFrame(flatMatches);
        gameStatus = 'falling'; // Deleting phase
        
        updateScoreUI();
        updateSpeed();
        
        setTimeout(() => {
            // Actually delete from grid
            flatMatches.forEach(m => { grid[m.r][m.c] = 0; });
            renderFrame();
            
            // Loop back to gravity
            if(applyGravity()) {
                renderFrame();
                setTimeout(resolveMatches, 300);
            } else {
                resolveMatches();
            }
        }, 400); // Wait for pop animation
        
    } else {
        // 連鎖終了
        chainCount = 0;
        chainEl.classList.add('hidden');
        
        // 1000点などのマイルストーンに到達したか確認
        if (score >= nextQuizThreshold) {
            triggerMilestoneQuiz();
        } else {
            gameStatus = 'playing';
            spawnPuyo();
        }
    }
}

function findMatches() {
    let visited = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    let groups = [];
    
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] !== 0 && !visited[r][c]) {
                let puyoType = grid[r][c];
                let group = [];
                let queue = [{r, c}];
                visited[r][c] = true;
                
                while(queue.length > 0) {
                    let curr = queue.shift();
                    group.push(curr);
                    // neighbors
                    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                    for(let d of dirs) {
                        let nr = curr.r + d[0];
                        let nc = curr.c + d[1];
                        if (nr>=0 && nr<ROWS && nc>=0 && nc<COLS && !visited[nr][nc] && grid[nr][nc] === puyoType) {
                            visited[nr][nc] = true;
                            queue.push({r: nr, c: nc});
                        }
                    }
                }
                if (group.length >= 4) {
                    groups.push(group);
                }
            }
        }
    }
    return groups;
}

// --- QUIZ LOGIC ---
function triggerMilestoneQuiz() {
    gameStatus = 'quiz';
    questionsRemaining = 5;
    
    // 次のクイズラインを更新 (例: 現在1300点なら次は2000点)
    nextQuizThreshold = Math.floor(score / 1000) * 1000 + 1000; 
    
    document.getElementById('overlay').classList.remove('hidden');
    const modal = document.getElementById('quiz-modal');
    modal.classList.remove('hidden');
    
    showNextQuestion();
}

function showNextQuestion() {
    if (questionsRemaining <= 0) {
        // クイズ終了、ボーナスによってまた1000点ラインを越えてしまうのを防ぐため再更新
        nextQuizThreshold = Math.max(nextQuizThreshold, Math.floor(score / 1000) * 1000 + 1000);
        
        document.getElementById('quiz-modal').classList.add('hidden');
        document.getElementById('overlay').classList.add('hidden');
        gameStatus = 'playing';
        spawnPuyo();
        return;
    }
    
    document.querySelector('.quiz-badge').textContent = `1000点突破ボーナス！(残り ${questionsRemaining} 問)`;
    document.getElementById('quiz-next-btn').classList.add('hidden');
    document.getElementById('quiz-feedback').classList.add('hidden');
    
    const randomIdx = Math.floor(Math.random() * QUIZZES.length);
    const qData = QUIZZES[randomIdx];
    document.getElementById('quiz-question').textContent = qData.q;
    
    const choiceBox = document.getElementById('quiz-choices');
    choiceBox.innerHTML = '';
    
    let opts = qData.c.map((text, idx) => ({ text, isCorrect: idx === qData.a }));
    opts.sort(() => Math.random() - 0.5);
    
    opts.forEach((opt, idx) => {
        let btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = `${idx + 1}. ${opt.text}`;
        btn.addEventListener('click', () => handleQuizAnswer(opt.isCorrect, qData.exp, btn));
        choiceBox.appendChild(btn);
    });
    
    document.getElementById('quiz-choices').style.display = 'flex';
}

function handleQuizAnswer(isCorrect, exp, clickedBtn) {
    const btns = document.querySelectorAll('.choice-btn');
    btns.forEach(b => b.disabled = true);
    
    if (isCorrect) {
        score += 100;
        clickedBtn.classList.add('correct');
        document.getElementById('quiz-icon').textContent = '⭕ 大正解！ (+100点)';
        document.getElementById('quiz-icon').style.color = '#10b981';
    } else {
        score -= 100;
        clickedBtn.classList.add('wrong');
        document.getElementById('quiz-icon').textContent = '❌ ざんねん！ (-100点)';
        document.getElementById('quiz-icon').style.color = '#ef4444';
        
        btns.forEach(b => {
            if (QUIZZES.some(q => q.c[q.a] && b.textContent.includes(q.c[q.a]))) {
                b.classList.add('correct');
            }
        });
    }
    
    updateScoreUI();
    updateSpeed();
    
    document.getElementById('quiz-explanation').textContent = exp;
    document.getElementById('quiz-feedback').classList.remove('hidden');
    
    setTimeout(() => {
        document.getElementById('quiz-next-btn').classList.remove('hidden');
    }, 1200);
}

document.getElementById('quiz-next-btn').addEventListener('click', () => {
    questionsRemaining--;
    showNextQuestion();
});

function updateScoreUI() {
    scoreEl.textContent = score;
    scoreEl.style.transform = 'scale(1.2)';
    setTimeout(() => { scoreEl.style.transform = 'scale(1)'; }, 200);
}

function gameOver() {
    gameStatus = 'gameover';
    clearInterval(dropIntervalId);
    
    // Save Score
    saveScore(score);
    
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('game-over-modal').classList.remove('hidden');
    document.getElementById('final-score').textContent = score;
    renderRanking('ranking-list');
}

function saveScore(newScore) {
    if (newScore <= 0) return;
    let ranks = JSON.parse(localStorage.getItem('puyoRanking') || '[]');
    ranks.push({ name: playerName, score: newScore, date: new Date().getTime() });
    ranks.sort((a, b) => b.score - a.score);
    ranks = ranks.slice(0, 10); // Keep top 10
    localStorage.setItem('puyoRanking', JSON.stringify(ranks));
}

function renderRanking(listId) {
    let ranks = JSON.parse(localStorage.getItem('puyoRanking') || '[]');
    const list = document.getElementById(listId);
    if(!list) return;
    list.innerHTML = '';
    
    if(ranks.length === 0) {
        list.innerHTML = '<tr><td colspan="3">まだ記録がありません</td></tr>';
        return;
    }
    
    ranks.forEach((r, idx) => {
        let tr = document.createElement('tr');
        let medal = '';
        if (idx === 0) medal = '<span class="medal">🥇</span>';
        else if (idx === 1) medal = '<span class="medal">🥈</span>';
        else if (idx === 2) medal = '<span class="medal">🥉</span>';
        else medal = `${idx + 1}`;
        
        // ハイライト（直近の自分のスコアかを判定。厳密には時刻で判定）
        if (r.name === playerName && r.score === score && Math.abs(new Date().getTime() - r.date) < 2000) {
            tr.classList.add('my-score');
        }
        
        tr.innerHTML = `<td>${medal}</td><td>${r.name}</td><td>${r.score}</td>`;
        list.appendChild(tr);
    });
}

// --- CONTROLS ---

function moveH(dir) {
    if (gameStatus !== 'playing' || !activePuyo) return;
    if (canMove(activePuyo.r, activePuyo.c + dir, activePuyo.r2, activePuyo.c2 + dir)) {
        activePuyo.c += dir; activePuyo.c2 += dir;
        renderFrame();
    }
}

function rotate() {
    if (gameStatus !== 'playing' || !activePuyo) return;
    // 0: partner is above(N), 1: right(E), 2: below(S), 3: left(W)
    let nrot = (activePuyo.rot + 1) % 4;
    let nr2 = activePuyo.r, nc2 = activePuyo.c;
    if (nrot === 0) { nr2 = activePuyo.r - 1; nc2 = activePuyo.c; }
    if (nrot === 1) { nr2 = activePuyo.r; nc2 = activePuyo.c + 1; }
    if (nrot === 2) { nr2 = activePuyo.r + 1; nc2 = activePuyo.c; }
    if (nrot === 3) { nr2 = activePuyo.r; nc2 = activePuyo.c - 1; }
    
    // wall kick or piece kick
    if (!canMove(activePuyo.r, activePuyo.c, nr2, nc2)) {
        // try shifting pivot left
        if (canMove(activePuyo.r, activePuyo.c - 1, nr2, nc2 - 1)) {
            activePuyo.c--; nc2--;
        } 
        // try shifting pivot right
        else if (canMove(activePuyo.r, activePuyo.c + 1, nr2, nc2 + 1)) {
            activePuyo.c++; nc2++;
        }
        else {
            return; // cannot rotate
        }
    }
    
    activePuyo.rot = nrot;
    activePuyo.r2 = nr2;
    activePuyo.c2 = nc2;
    renderFrame();
}

function fastDrop() {
    if (gameStatus !== 'playing' || !activePuyo) return;
    // drop down completely
    while(canMove(activePuyo.r + 1, activePuyo.c, activePuyo.r2 + 1, activePuyo.c2)) {
        activePuyo.r++; activePuyo.r2++;
    }
    renderFrame();
    lockPuyo();
}

document.addEventListener('keydown', e => {
    if (gameStatus !== 'playing') return;
    if (e.key === 'ArrowLeft') moveH(-1);
    if (e.key === 'ArrowRight') moveH(1);
    if (e.key === 'ArrowUp' || e.key === 'x' || e.key === 'X') rotate();
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        gameStep();
    }
    if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        fastDrop();
    }
});

document.getElementById('name-submit-btn').addEventListener('click', () => {
    let nameInput = document.getElementById('player-name').value.trim();
    if (nameInput) {
        playerName = nameInput;
        startGame();
    } else {
        alert('なまえを入力してね！');
    }
});

// `start-btn` initially shouldn't restart if name not entered, but let's allow it to reset.
function returnToTop() {
    gameStatus = 'menu';
    if (dropIntervalId) clearInterval(dropIntervalId);
    
    document.getElementById('game-over-modal').classList.add('hidden');
    document.getElementById('overlay').classList.remove('hidden');
    document.getElementById('name-modal').classList.remove('hidden');
    renderRanking('top-ranking-list');
}

document.getElementById('start-btn').addEventListener('click', () => {
    if (gameStatus === 'playing') {
        returnToTop();
    } else {
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('name-modal').classList.remove('hidden');
    }
});
document.getElementById('restart-btn').addEventListener('click', returnToTop);

// Initialization
renderRanking('top-ranking-list');
renderFrame();
