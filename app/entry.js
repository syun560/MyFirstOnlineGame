'use strict';
import $ from 'jquery';
import io from 'socket.io-client';

const gameObj = {
    raderCanvasWidth: 500,
    raderCanvasHeight: 500,
    scoreCanvasWidth: 300,
    scoreCanvasHeight: 500,
    itemRadius: 4,
    airRadius: 5,
    bomCellPx: 32,
    deg: 0,
    counter: 0,
    rotationDegByDirection: {
        'left': 0,
        'up': 270,
        'down': 90,
        'right': 0
    },
    rotationDegByMissileDirection: {
        'left': 270,
        'up': 0,
        'down': 180,
        'right': 90
    },
    myDisplayName: $('#main').attr('data-displayName'),
    myThumbUrl: $('#main').attr('data-thumbUrl'),
    fieldWidth: null,
    fieldHeight: null,
    itemsMap: new Map(),
    airMap: new Map(),
    missilesMap: new Map()
};

const socketQueryParameters = `displayName=${gameObj.myDisplayName}&thumbUrl=${gameObj.myThumbUrl}`;
const socket = io($('#main').attr('data-ipAddress') + '?' + socketQueryParameters);

function init() {

    // ゲーム用のキャンバス
    const raderCanvas = $('#rader')[0];
    raderCanvas.width = gameObj.raderCanvasWidth;
    raderCanvas.height = gameObj.raderCanvasHeight;
    gameObj.ctxRader = raderCanvas.getContext('2d');
    
    // ランキング用のキャンバス
    const scoreCanvas = $('#score')[0];
    scoreCanvas.width = gameObj.scoreCanvasWidth;
    scoreCanvas.height = gameObj.scoreCanvasHeight;
    gameObj.ctxScore = scoreCanvas.getContext('2d');

    // プレイヤーの画像
    const playerImage = new Image();
    playerImage.src = '/images/submarine.png';
    gameObj.playerImage = playerImage;

    // ミサイルの画像
    gameObj.missileImage = new Image();
    gameObj.missileImage.src = '/images/missile.png'

    // 爆発のアニメーション
    gameObj.bomListImage = new Image();
    gameObj.bomListImage.src = '/images/bomlist.png';
}
init();

function ticker() {
    if (!gameObj.myPlayerObj || !gameObj.playersMap) return;
    
    gameObj.ctxRader.clearRect(0, 0, gameObj.raderCanvasWidth, gameObj.raderCanvasHeight); //まっさら
    drawRader(gameObj.ctxRader);
    drawMap(gameObj);
    drawPlayer(gameObj.ctxRader, gameObj.myPlayerObj);
    if (gameObj.myPlayerObj.isAlive === false && gameObj.myPlayerObj.deadCount > 60) {
        drawGameOver(gameObj.ctxRader);
    }

    gameObj.ctxScore.clearRect(0, 0, gameObj.scoreCanvasWidth, gameObj.scoreCanvasHeight);
    drawAirTimer(gameObj.ctxScore, gameObj.myPlayerObj.airTime);
    drawMissiles(gameObj.ctxScore, gameObj.myPlayerObj.missilesMany);
    drawScore(gameObj.ctxScore, gameObj.myPlayerObj.score);
    drawRanking(gameObj.ctxScore, gameObj.playersMap);

    moveInClient(gameObj.myPlayerObj, gameObj.missilesMap);

    gameObj.counter = (gameObj.counter + 1) % 10000;
}
setInterval(ticker, 33);

function drawGameOver(ctxRader) {
    ctxRader.font = 'bold 76px arial black';
    ctxRader.fillStyle = 'rgb(0, 220, 250)';
    ctxRader.fillText('Game Over', 20, 270);
    ctxRader.strokeStyle = 'rgb(0, 0, 0)';
    ctxRader.lineWidth = 3;
    ctxRader.strokeText('Game Over', 20, 270);
}

$(window).keydown(function(event) {
    if (!gameObj.myPlayerObj || gameObj.myPlayerObj.isAlive === false) return;

    switch (event.key) {
        case 'ArrowLeft':
            if (gameObj.myPlayerObj.direction === 'left') break; // 変わってない
            gameObj.myPlayerObj.direction = 'left';
            drawPlayer(gameObj.ctxRader, gameObj.myPlayerObj);
            sendChangeDirection(socket, 'left');
            break;
        case 'ArrowUp':
            if (gameObj.myPlayerObj.direction === 'up') break; // 変わってない
            gameObj.myPlayerObj.direction = 'up';
            drawPlayer(gameObj.ctxRader, gameObj.myPlayerObj);
            sendChangeDirection(socket, 'up');
            break;
        case 'ArrowDown':
            if (gameObj.myPlayerObj.direction === 'down') break; // 変わってない
            gameObj.myPlayerObj.direction = 'down';
            drawPlayer(gameObj.ctxRader, gameObj.myPlayerObj);
            sendChangeDirection(socket, 'down');
            break;
        case 'ArrowRight':
            if (gameObj.myPlayerObj.direction === 'right') break; // 変わってない
            gameObj.myPlayerObj.direction = 'right';
            drawPlayer(gameObj.ctxRader, gameObj.myPlayerObj);
            sendChangeDirection(socket, 'right');
            break;
        case ' ': // スペースキー
            if (gameObj.myPlayerObj.missilesMany <= 0) break; // ミサイルのストックが 0
 
            gameObj.myPlayerObj.missilesMany -= 1;
            const missileId = Math.floor(Math.random() * 100000) + ',' + gameObj.myPlayerObj.socketId + ',' + gameObj.myPlayerObj.x + ',' + gameObj.myPlayerObj.y;

            const missileObj = {
                emitPlayerId: gameObj.myPlayerObj.playerId,
                x: gameObj.myPlayerObj.x,
                y: gameObj.myPlayerObj.y,
                direction: gameObj.myPlayerObj.direction,
                id: missileId
            };
            gameObj.missilesMap.set(missileId, missileObj);
            sendMissileEmit(socket, gameObj.myPlayerObj.direction);
            break;
    }
});

function sendChangeDirection(socket, direction) {
    socket.emit('change direction', direction);
}

function sendMissileEmit(socket, direction) {
    socket.emit('missile emit', direction);
}

function moveInClient(myPlayerObj, missilesMap) {

    if (myPlayerObj.isAlive === false) {
        if (myPlayerObj.deadCount < 60) {
            myPlayerObj.deadCount += 1;
        }
        return;
    }

    // 移動
    switch (myPlayerObj.direction) {
        case 'left':
            myPlayerObj.x -= 1;
            break;
        case 'up':
            myPlayerObj.y -= 1;
            break;
        case 'down':
            myPlayerObj.y += 1;
            break;
        case 'right':
            myPlayerObj.x += 1;
            break;
    }
    if (myPlayerObj.x > gameObj.fieldWidth) myPlayerObj.x -= gameObj.fieldWidth;
    if (myPlayerObj.x < 0) myPlayerObj.x += gameObj.fieldWidth;
    if (myPlayerObj.y < 0) myPlayerObj.y += gameObj.fieldHeight;
    if (myPlayerObj.y > gameObj.fieldHeight) myPlayerObj.y -= gameObj.fieldHeight;

    myPlayerObj.aliveTime.clock += 1;
    if (myPlayerObj.aliveTime.clock === 30) {
        myPlayerObj.aliveTime.clock = 0;
        myPlayerObj.aliveTime.seconds += 1;
    }

    // 飛んでいるミサイルの移動
    for (let [missileId, missile] of missilesMap) {

        switch (missile.direction) {
            case 'left':
                missile.x -= gameObj.missileSpeed;
                break;
            case 'up':
                missile.y -= gameObj.missileSpeed;
                break;
            case 'down':
                missile.y += gameObj.missileSpeed;
                break;
            case 'right':
                missile.x += gameObj.missileSpeed;
                break;
        }
        if (missile.x > gameObj.fieldWidth) missile.x -= gameObj.fieldWidth;
        if (missile.x < 0) missile.x += gameObj.fieldWidth;
        if (missile.y < 0) missile.y += gameObj.fieldHeight;
        if (missile.y > gameObj.fieldHeight) missile.y -= gameObj.fieldHeight;
    }
}

function drawRader(ctxRader) {
    const x = gameObj.raderCanvasWidth / 2;
    const y = gameObj.raderCanvasHeight / 2;
    const r = gameObj.raderCanvasWidth * 1.5 / 2; // 対角線の長さの半分

    ctxRader.save(); // セーブ

    ctxRader.beginPath();
    ctxRader.translate(x, y);
    ctxRader.rotate(getRadian(gameObj.deg));

    ctxRader.fillStyle = 'rgba(0, 220, 0, 0.5)';

    ctxRader.arc(0, 0, r, getRadian(0), getRadian(-30), true);
    ctxRader.lineTo(0, 0);

    ctxRader.fill();

    ctxRader.restore(); // 元の設定を取得
    gameObj.deg = (gameObj.deg + 5) % 360;
}

function drawMap(gameObj) {
    
    // 敵プレイヤーと NPC の描画
    for (let [key, tekiPlayerObj] of gameObj.playersMap) {
        if (key === gameObj.myPlayerObj.playerId) { continue; } // 自分は描画しない
    
        const distanceObj = calcDistance(
            gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
            tekiPlayerObj.x, tekiPlayerObj.y,
            gameObj.fieldWidth, gameObj.fieldHeight,
            gameObj.raderCanvasWidth, gameObj.raderCanvasHeight
        );
    
        if (distanceObj.distanceX <= (gameObj.raderCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.raderCanvasHeight / 2)) {
    
            if (tekiPlayerObj.isAlive === false) {
                drawBom(gameObj.ctxRader, distanceObj.drawX, distanceObj.drawY, tekiPlayerObj.deadCount);
                continue;
            }

            const degDiff = calcDegDiffFromRader(gameObj.deg, distanceObj.deg);
            const toumeido = calcOpacity(degDiff);

            const drawRadius = gameObj.counter % 12 + 2 + 12;
            const clearRadius = drawRadius - 2;
            const drawRadius2 = gameObj.counter % 12 + 2;
            const clearRadius2 = drawRadius2 - 2;

            gameObj.ctxRader.fillStyle = `rgba(0, 0, 255, ${toumeido})`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

            gameObj.ctxRader.fillStyle = `rgb(0, 20, 50)`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

            gameObj.ctxRader.fillStyle = `rgba(0, 0, 255, ${toumeido})`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius2, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

            gameObj.ctxRader.fillStyle = `rgb(0, 20, 50)`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius2, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

            if (tekiPlayerObj.displayName === 'anonymous') {

                gameObj.ctxRader.strokeStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.fillStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.moveTo(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20 + 40, distanceObj.drawY - 20);
                gameObj.ctxRader.stroke();

                gameObj.ctxRader.font = '8px Arial';
                gameObj.ctxRader.fillText('anonymous', distanceObj.drawX + 20, distanceObj.drawY - 20 - 1);

            } else if (tekiPlayerObj.displayName) {

                gameObj.ctxRader.strokeStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.fillStyle = `rgba(250, 250, 250, ${toumeido})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.moveTo(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20 + 40, distanceObj.drawY - 20);
                gameObj.ctxRader.stroke();

                gameObj.ctxRader.font = '8px Arial';
                gameObj.ctxRader.fillText(tekiPlayerObj.displayName, distanceObj.drawX + 20, distanceObj.drawY - 20 - 1);

            }
        }
    }

    // アイテムの描画
    for (let [index, item] of gameObj.itemsMap) {
        
        const distanceObj = calcDistance(
            gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
            item.x, item.y,
            gameObj.fieldWidht, gameObj.fieldHeight,
            gameObj.raderCanvasWidth, gameObj.raderCanvasHeight
        );

        if (distanceObj.distanceX <= (gameObj.raderCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.raderCanvasHeight / 2)){
            
            const degDiff = calcDegDiffFromRader(gameObj.deg, distanceObj.deg);
            const opacity = calcOpacity(degDiff);

            gameObj.ctxRader.fillStyle = `rgba(255, 165, 0, ${opacity})`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, gameObj.itemRadius, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

        }
    }

    // 空気の描画
    for (let [index, air] of gameObj.airMap) {
        
        const distanceObj = calcDistance(
            gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
            air.x, air.y,
            gameObj.fieldWidht, gameObj.fieldHeight,
            gameObj.raderCanvasWidth, gameObj.raderCanvasHeight
        );

        if (distanceObj.distanceX <= (gameObj.raderCanvasWidth / 2) && distanceObj.distanceY <= (gameObj.raderCanvasHeight / 2)){
            
            const degDiff = calcDegDiffFromRader(gameObj.deg, distanceObj.deg);
            const opacity = calcOpacity(degDiff);

            gameObj.ctxRader.fillStyle = `rgba(0, 220, 255, ${opacity})`;
            gameObj.ctxRader.beginPath();
            gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, gameObj.airRadius, 0, Math.PI * 2, true);
            gameObj.ctxRader.fill();

        }
    }

   // 飛んでいるミサイルの描画
    for (let [missileId, missile] of gameObj.missilesMap) {

        const distanceObj = calcDistance(
            gameObj.myPlayerObj.x, gameObj.myPlayerObj.y,
            missile.x, missile.y,
            gameObj.fieldWidth, gameObj.fieldHeight,
            gameObj.raderCanvasWidth, gameObj.raderCanvasHeight
        );

        if (
            distanceObj.distanceX <= (gameObj.raderCanvasWidth / 2 + 50) &&
            distanceObj.distanceY <= (gameObj.raderCanvasHeight / 2 + 50)
        ) {

            if (missile.emitPlayerId === gameObj.myPlayerObj.playerId) { // 自分自身のミサイルの描画

                const rotationDeg = gameObj.rotationDegByMissileDirection[missile.direction];
                gameObj.ctxRader.save();
                gameObj.ctxRader.translate(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.rotate(getRadian(rotationDeg));
                gameObj.ctxRader.drawImage(
                    gameObj.missileImage, -gameObj.missileImage.width / 2, -gameObj.missileImage.height / 2
                );
                gameObj.ctxRader.restore();

                gameObj.ctxRader.strokeStyle = "rgba(250, 250, 250, 0.9)";
                gameObj.ctxRader.fillStyle = "rgba(250, 250, 250, 0.9)";
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.moveTo(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20, distanceObj.drawY - 20);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 20 + 35, distanceObj.drawY - 20);
                gameObj.ctxRader.stroke();

                gameObj.ctxRader.font = '11px Arial';
                gameObj.ctxRader.fillText('missile', distanceObj.drawX + 20, distanceObj.drawY - 20 - 2);

            } else { // 他人のミサイルの描画

                const degDiff = calcDegDiffFromRader(gameObj.deg, distanceObj.deg);
                const opacity = calcOpacity(degDiff);

                const drawRadius1 = gameObj.counter % 8 + 2 + 20;
                const clearRadius1 = drawRadius1 - 2;
                const drawRadius2 = gameObj.counter % 8 + 2 + 10;
                const clearRadius2 = drawRadius2 - 2;
                const drawRadius3 = gameObj.counter % 8 + 2 + 0;
                const clearRadius3 = drawRadius3 - 2;

                gameObj.ctxRader.fillStyle = `rgba(255, 0, 0, ${opacity})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius1, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = "rgb(0, 20, 50)";
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius1, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = `rgba(255, 0, 0, ${opacity})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius2, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = "rgb(0, 20, 50)";
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius2, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = `rgba(255, 0, 0, ${opacity})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, drawRadius3, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.fillStyle = "rgb(0, 20, 50)";
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.arc(distanceObj.drawX, distanceObj.drawY, clearRadius3, 0, Math.PI * 2, true);
                gameObj.ctxRader.fill();

                gameObj.ctxRader.strokeStyle = `rgba(250, 250, 250, ${opacity})`;
                gameObj.ctxRader.fillStyle = `rgba(250, 250, 250, ${opacity})`;
                gameObj.ctxRader.beginPath();
                gameObj.ctxRader.moveTo(distanceObj.drawX, distanceObj.drawY);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 30, distanceObj.drawY - 30);
                gameObj.ctxRader.lineTo(distanceObj.drawX + 30 + 35, distanceObj.drawY - 30);
                gameObj.ctxRader.stroke();

                gameObj.ctxRader.font = '11px Arial';
                gameObj.ctxRader.fillText('missile', distanceObj.drawX + 30, distanceObj.drawY - 30 - 2);
            }
        }
    }
}

function drawPlayer(ctxRader, myPlayerObj) {

    if (myPlayerObj.isAlive === false) {
        drawBom(ctxRader, gameObj.raderCanvasWidth / 2, gameObj.raderCanvasHeight / 2, myPlayerObj.deadCount);
        return;
    }
    
    
    const rotationDeg = gameObj.rotationDegByDirection[myPlayerObj.direction];
    
    ctxRader.save();
    ctxRader.translate(gameObj.raderCanvasWidth / 2, gameObj.scoreCanvasHeight / 2);
    ctxRader.rotate(getRadian(rotationDeg));
    if(myPlayerObj.direction === 'left') {
        ctxRader.scale(-1, 1);
    }

    ctxRader.drawImage(
        gameObj.playerImage, -(gameObj.playerImage.width / 2), -(gameObj.playerImage.height / 2)
    );    
    ctxRader.restore();
}

function drawBom(ctxRader, drawX, drawY, deadCount) {
    if (deadCount >= 60) return;

    const drawBomNumber = Math.floor(deadCount / 5);
    const cropX = (drawBomNumber % (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;
    const cropY = Math.floor(drawBomNumber / (gameObj.bomListImage.width / gameObj.bomCellPx)) * gameObj.bomCellPx;

    ctxRader.drawImage(
        gameObj.bomListImage,
        cropX, cropY,
        gameObj.bomCellPx, gameObj.bomCellPx,
        drawX - gameObj.bomCellPx / 2, drawY - gameObj.bomCellPx / 2,
        gameObj.bomCellPx, gameObj.bomCellPx
    ); // 画像データ、切り抜き左、切り抜き上、幅、幅、表示x、表示y、幅、幅
}

function drawMissiles(ctxScore, missilesMany) {
    for (let i = 0; i < missilesMany; i++) {
        ctxScore.drawImage(gameObj.missileImage, 50 * i, 80);
    }
}

function drawAirTimer(ctxScore, airTime) {
    ctxScore.fillStyle = "rgb(0, 220, 250)";
    ctxScore.font = 'bold 40px Arial';
    ctxScore.fillText(airTime, 110, 50);
}

function drawScore(ctxScore, score) {
    ctxScore.fillStyle = "rgb(26, 26, 26)";
    ctxScore.font = '28px Arial';
    ctxScore.fillText(`score: ${score}`, 10, 180);
}

function drawRanking(ctxScore, playersMap) {
    const playersArray = [].concat(Array.from(playersMap));
    playersArray.sort(function(a, b) {
        return b[1].score - a[1].score;
    });

    ctxScore.fillStyle = "rgb(0, 0, 0)";
    ctxScore.fillRect(0, 220, gameObj.scoreCanvasWidth, 3);

    ctxScore.fillStyle = "rgb(26, 26, 26)";
    ctxScore.font = '20px Arial';

    for (let i = 0; i < 10; i++) {
        if (!playersArray[i]) return;

        const rank = i + 1;
        ctxScore.fillText(
            `${rank}th ${playersArray[i][1].displayName} ${playersArray[i][1].score}`,
            10, 220 + (rank * 26)
        );
    }
}


socket.on('start data', (startObj) => {
    gameObj.fieldWidth = startObj.fieldWidth;
    gameObj.fieldHeight = startObj.fieldHeight;
    gameObj.myPlayerObj = startObj.playerObj;
    gameObj.missileSpeed = startObj.missileSpeed;
});

socket.on('map data', (compressed) => {
    const playersArray = compressed[0];
    const itemsArray = compressed[1];
    const airArray = compressed[2];
    const missilesArray = compressed[3];

    gameObj.playersMap = new Map();
    for (let compressedPlayerData of playersArray) {

        const player = {};
        player.x = compressedPlayerData[0];
        player.y = compressedPlayerData[1];
        player.playerId = compressedPlayerData[2];
        player.displayName = compressedPlayerData[3];
        player.score = compressedPlayerData[4];
        player.isAlive = compressedPlayerData[5];
        player.direction = compressedPlayerData[6];
        player.missilesMany = compressedPlayerData[7];
        player.airTime = compressedPlayerData[8];
        player.deadCount = compressedPlayerData[9];

        gameObj.playersMap.set(player.playerId, player);

        // 自分の情報も更新
        if (player.playerId === gameObj.myPlayerObj.playerId) {
            gameObj.myPlayerObj.x = compressedPlayerData[0];
            gameObj.myPlayerObj.y = compressedPlayerData[1];
            gameObj.myPlayerObj.displayName = compressedPlayerData[3];
            gameObj.myPlayerObj.score = compressedPlayerData[4];
            gameObj.myPlayerObj.isAlive = compressedPlayerData[5];
            gameObj.myPlayerObj.missilesMany = compressedPlayerData[7];
            gameObj.myPlayerObj.airTime = compressedPlayerData[8];
            gameObj.myPlayerObj.deadCount = compressedPlayerData[9];
        }
    }

    gameObj.itemsMap = new Map();
    itemsArray.forEach((compressedItemData, index) => {
        gameObj.itemsMap.set(index, { x: compressedItemData[0], y: compressedItemData[1] });
    });

    gameObj.airMap = new Map();
    airArray.forEach((compressedAirData, index) => {
        gameObj.airMap.set(index, { x: compressedAirData[0], y: compressedAirData[1] });
    });

    gameObj.missilesMap = new Map();
    missilesArray.forEach((compressedMissileData, index) => {
        gameObj.missilesMap.set(index, {
            x: compressedMissileData[0],
            y: compressedMissileData[1],
            direction: compressedMissileData[2],
            emitPlayerId: compressedMissileData[3],
        })
    });
});

function getRadian(kakudo) {
    return kakudo * Math.PI / 180;
}

function calcDistance(pX, pY, oX, oY, gameWidth, gameHeight, raderCanvasWidth, raderCanvasHeight) {
    let distanceX = 99999999;
    let distanceY = 99999999;
    let drawX = null;
    let drawY = null;
 
    if (pX <= oX) {
        // 右から
        distanceX = oX - pX;
        drawX = (raderCanvasWidth / 2) + distanceX;
        // 左から
        let tmpDistance = pX + gameWidth - oX;
        if (distanceX > tmpDistance) {
            distanceX = tmpDistance;
            drawX = (raderCanvasWidth / 2) - distanceX;
        }
 
    } else {
        // 右から
        distanceX = pX - oX;
        drawX = (raderCanvasWidth / 2) - distanceX;
        // 左から
        let tmpDistance = oX + gameWidth - pX;
        if (distanceX > tmpDistance) {
            distanceX = tmpDistance;
            drawX = (raderCanvasWidth / 2) + distanceX;
        }
    }
 
    if (pY <= oY) {
        // 下から
        distanceY = oY - pY;
        drawY = (raderCanvasHeight / 2) + distanceY;
        // 上から
        let tmpDistance = pY + gameHeight - oY;
        if (distanceY > tmpDistance) {
            distanceY = tmpDistance;
            drawY = (raderCanvasHeight / 2) - distanceY;
        }
 
    } else {
        // 上から
        distanceY = pY - oY;
        drawY = (raderCanvasHeight / 2) - distanceY;
        // 下から
        let tmpDistance = oY + gameHeight - pY;
        if (distanceY > tmpDistance) {
            distanceY = tmpDistance;
            drawY = (raderCanvasHeight / 2) + distanceY;
        }
    }

    const deg = calcTwoPointsDeg(drawX, drawY, raderCanvasWidth / 2, raderCanvasHeight / 2);

    return {
        distanceX,
        distanceY,
        drawX,
        drawY,
        deg
    };
}

function calcTwoPointsDeg(x1, y1, x2, y2) {
    const radian = Math.atan2(y2 - y1, x2 - x1);
    const deg = radian * 180 / Math.PI + 180;
    return deg;
}

function calcDegDiffFromRader(degRader, degItem) {
    let diff = degRader - degItem;
    if (diff < 0) {
        diff += 360;
    }
    
    return diff;
}

function calcOpacity(degDiff) {
    const deleteDeg = 270;
    degDiff = degDiff > deleteDeg ? deleteDeg : degDiff; // もう少しだけ暗くするコツ
    return (1 - degDiff / deleteDeg).toFixed(2);
}