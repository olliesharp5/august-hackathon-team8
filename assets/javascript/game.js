import {
    saveScore,
    getLeaderboard
} from '/assets/javascript/firebase.js';

// Menu
// Calls playGame() or leaderBoard()
document.addEventListener("DOMContentLoaded", function () {
    let buttons = document.getElementsByTagName("button");
    for (let button of buttons) {
        button.addEventListener("click", function () {
            if (this.getAttribute("data-type") === "play") {
                playGame();
            } else {
                if (this.getAttribute("data-type") === "leaderboard") {
                    leaderBoard();
                }
            }
        });
    }
});

/**
 * This function does:
 * handle the leaderboard
 **/
async function leaderBoard() {
    const leaderboard = await getLeaderboard();
    let leaderboardContent = `
    <main>
    <h1>Leaderboard</h1>
    <ul>
        ${leaderboard.map(entry => `<li>${entry.username}: ${entry.score}</li>`).join('')}
    </ul>
    <button data-type="play">Play Again</button>
    </main>
    `;
    document.body.innerHTML = leaderboardContent;
    document.querySelector('button[data-type="play"]').addEventListener('click', playGame);
}

let activeDucks = []; // Array to hold all active ducks

/**
 * Sets up the initial game state and starts the first level
 **/
function playGame() {
    const gameArea = document.getElementById('game-area');
    const gameState = {
        level: 1,
        remainingDucks: 0,
        misses: 0,
        maxMisses: 3,
        score: 0,
        totalDucks: 0, // Track the total ducks for the current level
        roundOver: false, // Flag to indicate if the round is over due to 3 misses
        levelTransitioning: false // Flag to prevent multiple level transitions
    };

    let gameContent = `
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <p id="display-score">Score: <span id="score">0</span></p>
    <p id="display-misses">Misses: <span id="misses">0</span>/<span id="max-misses">${gameState.maxMisses}</span></p>
    `;
    gameArea.innerHTML = gameContent;

    const canvas = document.getElementById('gameCanvas');

    if (canvas) {
        const ctx = canvas.getContext('2d');

        // Initialize the game
        startLevel(gameState, ctx, canvas);
    } else {
        console.error("Canvas element not found after attempting to create it!");
    }
}

/**
 * Prepares the game state for a new level by resetting the misses, setting the number of ducks for the level, and spawning them
 **/
function startLevel(gameState, ctx, canvas) {
    // Reset the misses and clear any previous ducks from the array
    gameState.misses = 0;
    gameState.roundOver = false; // Reset the roundOver flag for the new level
    gameState.levelTransitioning = false; // Ensure levelTransitioning is reset
    activeDucks = [];

    // Ensure the UI elements are reset correctly for the new level
    document.getElementById("display-misses").innerHTML = `Misses: <span id="misses">0</span>/<span id="max-misses">${gameState.maxMisses}</span>`;

    // Define the number of ducks per level
    const ducksPerRound = [6, 12, 18, 24, 30];
    gameState.totalDucks = ducksPerRound[gameState.level - 1];
    gameState.remainingDucks = gameState.totalDucks;

    spawnDucks(gameState, ctx); // Spawn the initial batch of ducks

    requestAnimationFrame(() => drawAllDucks(ctx)); // Start the centralized drawing loop

    // Ensure the click handler is only set once
    canvas.onclick = function (event) {
        if (gameState.roundOver || gameState.levelTransitioning) {
            return; // Do nothing if the round is over or if a level transition is in progress
        }

        let duckHit = false;

        const gunshot = new Audio('../assets/sounds/gunshot.mp3');
        gunshot.play();

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        // Check if the click hit any of the ducks
        activeDucks.forEach(duck => {
            const minAreaX = duck.x - duck.size;
            const maxAreaX = duck.x + duck.size / 2;
            const minAreaY = duck.y - duck.size;
            const maxAreaY = duck.y + duck.size / 2;

            if (x > minAreaX && x < maxAreaX && y > minAreaY && y < maxAreaY) {
                const blood = new Image();
                blood.src = 'assets/images/sprites/blood-splatter.jpg';
                ctx.drawImage(blood, duck.x, duck.y, duck.size, duck.size);
                duck.state = "dead";
                duck.fallSpeed = 15;
                gameState.score += 100; // Increase the score
                document.getElementById('score').innerText = gameState.score; // Update the score display
                duckHit = true;
            }
        });

        // If no duck was hit, increment misses
        if (!duckHit) {
            gameState.misses++;
            document.getElementById("display-misses").innerHTML = `Misses: <span id="misses">${gameState.misses}</span>/<span id="max-misses">${gameState.maxMisses}</span>`;

            // Check if the player has missed too many times
            if (gameState.misses >= gameState.maxMisses) {
                gameState.roundOver = true; // Set roundOver flag to true
                gameState.levelTransitioning = true; // Prevent further actions during transition
                console.log(`Player missed 3 times. Moving to next level.`);
                activeDucks = []; // Clear the active ducks array
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); // Clear the canvas

                // Display a message
                ctx.font = "30px Arial";
                ctx.fillText(`Level ${gameState.level} complete. Get ready for the next level...`, ctx.canvas.width / 2 - 200, ctx.canvas.height / 2);

                // Delay before starting the next level
                setTimeout(() => {
                    if (gameState.level < 5) {
                        gameState.level++;
                        console.log(`Starting Level ${gameState.level}`);

                        // Start the next level
                        startLevel(gameState, ctx, canvas); // Ensure canvas is passed correctly
                    } else {
                        console.log("You completed all levels!");
                        gameOver(gameState); // End the game
                    }
                }, 3000); // 3-second delay
                return; // Exit the function to prevent further execution after starting the next level
            }
        }

        // Check if all ducks are dead and there are still ducks remaining to be spawned
        if (activeDucks.length === 0 && gameState.remainingDucks > 0) {
            spawnDucks(gameState, ctx); // Spawn more ducks if there are ducks remaining
        } else if (activeDucks.length === 0 && gameState.remainingDucks === 0 && gameState.misses < gameState.maxMisses) {
            // Check if all ducks are gone and there are no remaining ducks
            if (gameState.level < 5 && !gameState.levelTransitioning) {
                // If there are levels left, advance to the next one
                gameState.levelTransitioning = true; // Prevent multiple transitions
                console.log(`Moving to next level.`);
                nextLevel(gameState, ctx, canvas);
            } else if (gameState.level >= 5) {
                // If it's the last level, trigger game over
                console.log("You completed all levels!");
                gameOver(gameState);
            }
        }
    };

    console.log(`Started Level ${gameState.level}`);
}

/**
 * Spawns the required number of ducks based on the level
 */
function spawnDucks(gameState, ctx) {
    const canvas = ctx.canvas;
    const ducksPerBatch = Math.min(2 * gameState.level, gameState.remainingDucks); // Number of ducks to spawn at once, ensuring it doesn't exceed the remaining ducks

    for (let i = 0; i < ducksPerBatch; i++) {
        const duck = createDuck(gameState.level, canvas);
        activeDucks.push(duck);
        animateDuck(duck, gameState, ctx);
    }

    gameState.remainingDucks -= ducksPerBatch; // Reduce the number of remaining ducks

    // Ensure that all ducks for the level are eventually spawned
    if (gameState.remainingDucks > 0 && activeDucks.length < ducksPerBatch) {
        spawnDucks(gameState, ctx); // Recursively spawn remaining ducks
    }
}

/**
 * Creates a new duck object for the game
 */
function createDuck(level, canvas) {
    const duckSize = 50 - (level * 5); // Decrease hitbox size with level
    const speed = 2 + (level * 1.5); // Increase speed with level

    // Randomly decide if the duck starts from the left or right border
    const startFromLeft = Math.random() < 0.5;

    const duck = {
        x: startFromLeft ? 0 : canvas.width - duckSize, // Start at the left or right border
        y: Math.random() * (canvas.height / 2),
        size: duckSize,
        speed: speed,
        state: "alive",
        fallSpeed: 0,
        lastX: null, // To track the duck's previous position to detect unexpected disappearance

        direction: Math.random() < 0.5 ? 1 : -1, // Randomly left or right
        spriteWidth: 125, // Width of a single frame in the sprite sheet
        spriteHeight: 100, // Height of a single frame in the sprite sheet
        totalFrames: 3, // Total number of animation frames
        currentFrame: 0, // Start at the first frame
        frameCounter: 0, // To control animation speed
        frameSpeed: 10 // How many game ticks before the next frame
    };

    return duck;
}

/**
 * Animates the duck
 */
function animateDuck(duck, gameState, ctx) {
    const canvas = ctx.canvas;
    const interval = setInterval(() => {
        if (duck.state === "alive") {
            duck.lastX = duck.x; // Track the last known x position
            duck.x += duck.speed * duck.direction;

            // Check for unexpected disappearance
            if (Math.abs(duck.x - duck.lastX) > canvas.width / 2) {
                console.warn("Duck disappeared unexpectedly. Respawning...");
                clearInterval(interval);
                activeDucks = activeDucks.filter(d => d !== duck);
                spawnDucks(gameState, ctx); // Respawn the duck
                return;
            }

            // Bounce off the walls
            if (duck.x <= 0 || duck.x + duck.size >= canvas.width) {
                duck.direction *= -1;
                duck.bounces = (duck.bounces || 0) + 1;

                if (duck.bounces >= 3) {
                    // Duck leaves the screen
                    clearInterval(interval);

                    // Remove duck from activeDucks array
                    activeDucks = activeDucks.filter(d => d !== duck);

                    // Check if there are more ducks to spawn
                    if (gameState.remainingDucks > 0) {
                        spawnDucks(gameState, ctx);
                    } else if (activeDucks.length === 0 && !gameState.levelTransitioning) {
                        // Move to the next level if all ducks are gone
                        if (gameState.level < 5) {
                            gameState.levelTransitioning = true; // Prevent multiple transitions
                            console.log(`Moving to next level.`);
                            nextLevel(gameState, ctx, canvas);
                        } else {
                            console.log("You completed all levels!");
                            gameOver(gameState); // End the game
                        }
                    }
                }
            }
        } else {
            // Duck is dead
            duck.y += duck.fallSpeed;
            if (duck.y >= canvas.height) {
                // Duck fell off the screen
                clearInterval(interval);
                activeDucks = activeDucks.filter(d => d !== duck);

                // Check if there are more ducks to spawn
                if (gameState.remainingDucks > 0) {
                    spawnDucks(gameState, ctx);
                } else if (activeDucks.length === 0 && !gameState.levelTransitioning) {
                    // Move to the next level if all ducks are gone
                    if (gameState.level < 5) {
                        gameState.levelTransitioning = true; // Prevent multiple transitions
                        console.log(`Moving to next level.`);
                        nextLevel(gameState, ctx, canvas);
                    } else {
                        console.log("You completed all levels!");
                        gameOver(gameState); // End the game
                    }
                }
            }
        }

        // Handle sprite animation
        duck.frameCounter++;
        if (duck.frameCounter >= duck.frameSpeed) {
            duck.currentFrame = (duck.currentFrame + 1) % duck.totalFrames;
            duck.frameCounter = 0;
        }

        // Draw the duck
        drawDuck(duck, ctx);
    }, 20);
}

/**
 * Draws all ducks on the canvas
 */
function drawAllDucks(ctx) {
    const canvas = ctx.canvas;

    // Clear the entire canvas before drawing the new frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all active ducks
    activeDucks.forEach(duck => {
        // Handle sprite animation
        duck.frameCounter++;
        if (duck.frameCounter >= duck.frameSpeed) {
            duck.currentFrame = (duck.currentFrame + 1) % duck.totalFrames;
            duck.frameCounter = 0;
        }

        drawDuck(duck, ctx);
    });

    requestAnimationFrame(() => drawAllDucks(ctx)); // Schedule the next frame
}

/**
 * Draws a single duck on the canvas
 */
function drawDuck(duck, ctx) {
    const aliveDuckSprite = new Image();
    aliveDuckSprite.src = 'assets/images/sprites/duck-sprite.png';

    const deadDuckSprite = new Image();
    deadDuckSprite.src = 'assets/images/sprites/dead-duck-sprite.png';

    // Save the current context state
    ctx.save();

    if (duck.state === "alive") {
        // Calculate the source x position of the current frame in the sprite sheet
        const srcX = duck.currentFrame * duck.spriteWidth;

        // Flip the duck horizontally ONLY if it's moving to the left
        if (duck.direction === -1) {
            ctx.translate(duck.x + duck.size, duck.y);
            ctx.scale(-1, 1);
        } else {
            ctx.translate(duck.x, duck.y);
        }

        // Draw the duck at its new position
        ctx.drawImage(
            aliveDuckSprite, // Image source
            srcX, 0, // Source x, y (top-left corner of the frame in the sprite sheet)
            duck.spriteWidth, duck.spriteHeight, // Source width, height (size of the frame)
            0, 0, // Destination x, y (already translated, so use 0, 0)
            duck.size, duck.size // Destination width, height (size on the canvas)
        );
    } else {
        ctx.translate(duck.x, duck.y);
        ctx.drawImage(
            deadDuckSprite, // Image source
            0, 0, // Source x, y (top-left corner of the frame in the sprite sheet)
            50, 50, // Source width, height (size of the frame)
            0, 0, // Destination x, y (already translated, so use 0, 0)
            duck.size, duck.size // Destination width, height (size on the canvas)
        );
    }

    // Restore the context to its original state
    ctx.restore();
}

/**
 * Handles leveling up the game
 */
function nextLevel(gameState, ctx, canvas) {
    if (gameState.level < 5) {
        gameState.level++;
        gameState.misses = 0; // Reset misses for the next level
        gameState.roundOver = false; // Reset the roundOver flag for the next level
        gameState.levelTransitioning = false; // Reset the levelTransitioning flag
        console.log(`Starting Level ${gameState.level}`);

        // Clear the canvas and show a message
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.font = "30px Arial";
        ctx.fillText(`Get ready for Level ${gameState.level}...`, ctx.canvas.width / 2 - 150, ctx.canvas.height / 2);

        // Delay before starting the next level
        setTimeout(() => {
            // Start the next level
            startLevel(gameState, ctx, canvas); // Ensure canvas is passed correctly
        }, 3000); // 3-second delay
    } else {
        console.log("You completed all levels!");
        gameOver(gameState); // End the game
    }
}

/**
 * Ends the game, saves the score, and displays the leaderboard
 */
function gameOver(gameState) {
    // Ensure that score is saved only once and is a valid number
    if (typeof gameState.score === 'number' && !isNaN(gameState.score)) {
        // Prompt the user for their username
        const username = prompt("Game Over! Please enter your username to save your score:");

        if (username) {
            saveScore(username, gameState.score).then(() => {
                alert(`Your score: ${gameState.score} has been saved!`);
                leaderBoard();
            }).catch(error => {
                console.error("Error saving score: ", error);
            });
        } else {
            alert("Score not saved because username was not provided.");
        }
    } else {
        console.error("Invalid score value. Game Over skipped score save.");
    }
}