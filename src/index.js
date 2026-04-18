/**
 * GEORGIAN WORD SCAPES - APP ENTRY POINT
 * მართავს ეკრანების გადართვას, ხმას და ინიციალიზაციას
 */

import { initGame, initLevel, onLevelComplete, onLevelSelected, shuffleLetters, gameState, updateCoinUI, saveCoins, showPremiumRewardAd } from './game.js';
import { initAdMob, attachRewardedVideoListener } from './admob.js';
import { levels } from './data/levels.js';
import AudioManager from './audio.js';
import { App as CapacitorApp } from '@capacitor/app';

// Lazy load AuthService - in browser mode it won't try to load Capacitor
let AuthService = null;
const loadAuthService = async () => {
  if (!AuthService) {
    try {
      const module = await import('./auth.js');
      AuthService = module.default;
    } catch (e) {
      console.warn('[App] AuthService unavailable in browser:', e.message);
    }
  }
  return AuthService;
};

const App = {
    currentLevelIndex: parseInt(localStorage.getItem('georgianWordscapes_currentLevel') || '0', 10),
    // ხმის მდგომარეობის ამოღება მეხსიერებიდან (თუ პირველი ჩართვაა, იქნება 'on')
    isAudioOn: localStorage.getItem('gameAudio') !== 'off',
    // მუსიკის მდგომარეობა
    isMusicOn: localStorage.getItem('gameMusic') !== 'off',
    // ხმის მდგომარეობა
    isSoundOn: localStorage.getItem('gameSound') !== 'off',
    // დონის პროგრესის ამოღება მეხსიერებიდან
    // Validate and ensure starts at 0 if corrupted
    maxUnlockedLevel: (() => {
        const stored = parseInt(localStorage.getItem('georgianWordscapes_level'), 10);
        // Reset if invalid (negative, NaN, Infinity, or out of bounds)
        if (!Number.isFinite(stored) || Number.isNaN(stored) || stored < 0 || stored >= 450) {
            localStorage.setItem('georgianWordscapes_level', '0');
            localStorage.setItem('georgianWordscapes_currentLevel', '0');
            console.log('[App] Progress reset to level 1 due to invalid saved data');
            return 0;
        }
        return stored;
    })(),
    
    init() {
        console.log("=== App.init() STARTING ===");
        
        // Set AudioManager with initial sound state
        AudioManager.setEnabled(this.isSoundOn);
        
        // Load and start background music (respects music setting)
        AudioManager.playBackgroundMusic();
        
        // Set up autoplay fallback in case browser blocks autoplay
        AudioManager.setupAutoplayFallback();
        
        // Force hide loading immediately
        const loadingEl = document.getElementById('loadingScreen');
        if (loadingEl) {
            loadingEl.style.display = 'none';
            console.log("[App] Loading hidden");
        }
        
        // ელემენტების ქეშირება
        this.mainMenu = document.getElementById('mainMenu');
        this.gameScreen = document.getElementById('gameScreen');
        this.playBtn = document.getElementById('playBtn');
        this.loadingScreen = loadingEl;
        
        console.log("[App] mainMenu:", this.mainMenu);
        console.log("[App] playBtn:", this.playBtn);
        
        // ხმის ღილაკის ელემენტები
        this.audioBtn = document.getElementById('audioBtn');
        this.audioIcon = document.getElementById('audioIcon');

        // Settings elements
        this.settingsOverlay = document.getElementById('settingsOverlay');
        this.gameSettingsBtn = document.getElementById('gameSettingsBtn');
        this.gameAudioBtn = document.getElementById('gameAudioBtn');
        this.gameAudioIcon = document.getElementById('gameAudioIcon');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.mainMenuBtn = document.getElementById('mainMenuBtn');
        this.mainMenuSettingsBtn = document.getElementById('settingsBtn');
        this.privacyPolicyBtn = document.getElementById('privacyPolicyBtn');
        this.musicToggle = document.querySelector('.puffy-toggle-btn');
        this.musicStatus = document.querySelector('.puffy-toggle-surface');
        this.soundToggle = document.querySelectorAll('.puffy-toggle-btn')[1];
        this.soundStatus = document.querySelectorAll('.puffy-toggle-surface')[1];
        this.allLevelsBtn = document.getElementById('allLevelsBtn');
        this.resumeBtn = document.getElementById('resumeBtn');
        this.restartBtn = document.getElementById('restartBtn');
        this.clickSound = document.getElementById('clickSound');

        this.levelSelectionOverlay = document.getElementById('levelSelectionOverlay');
        this.dailyRewardsOverlay = document.getElementById('dailyRewardsOverlay');
        this.loginOverlay = document.getElementById('loginOverlay');
        this.shuffleBtn = document.getElementById('shuffleNewBtn');
        this.rangeButtonsContainer = document.getElementById('rangeButtons');
        this.backToMenuBtn = document.getElementById('backToMenuBtn');

        // Capacitor app state listeners to handle background/foreground music
        this.setupAppStateListeners();

        // Create ambient particles
        this.createAmbientParticles();

        // Ensure screen defaults
        this.mainMenu.style.display = 'flex';
        this.gameScreen.style.display = 'none';
        this.mainMenu.classList.add('active');
        this.gameScreen.classList.remove('active');

        // Event Listeners
        console.log("[App] playBtn:", this.playBtn);
        this.playBtn.addEventListener('click', () => {
            console.log("[App] Play button clicked!");
            this.resumeGame();
        });
        
        // ხმის გადამრთველის Event Listener
        if (this.audioBtn) {
            this.audioBtn.addEventListener('click', () => this.toggleAudio());
        }

        // Game settings listeners
        if (this.gameSettingsBtn) {
            this.gameSettingsBtn.addEventListener('click', () => this.showSettings());
        }
        if (this.closeSettingsBtn) {
            this.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
        }
        this.settingsOverlay?.addEventListener('click', (e) => {
            if (e.target === this.settingsOverlay) {
                this.hideSettings();
            }
        });
        if (this.mainMenuBtn) {
            this.mainMenuBtn.addEventListener('click', () => this.returnToMenu());
        }
        if (this.gameAudioBtn) {
            this.gameAudioBtn.addEventListener('click', () => this.toggleAudio());
        }
        if (this.mainMenuSettingsBtn) {
            this.mainMenuSettingsBtn.addEventListener('click', () => this.showSettings());
        }
        
        if (this.privacyPolicyBtn) {
            this.privacyPolicyBtn.addEventListener('click', () => {
                this.hideSettings();
                // TODO: Replace YOUR_GITHUB_USERNAME with the actual GitHub username
                window.open('https://YOUR_GITHUB_USERNAME.github.io/georgian-wordscapes/privacy_policy.html', '_blank');
            });
        }

        if (this.musicToggle) {
            this.musicToggle.addEventListener('click', () => this.toggleMusic());
        }
        if (this.soundToggle) {
            this.soundToggle.addEventListener('click', () => this.toggleSound());
        }
        if (this.allLevelsBtn) {
            this.allLevelsBtn.addEventListener('click', () => {
                this.hideSettings();
                this.levelSelectionOverlay?.classList.add('visible');
                AudioManager.playWindow();
            });
        }

        if (this.resumeBtn) {
            this.resumeBtn.addEventListener('click', () => this.resumeGameFromModal());
        }

        if (this.restartBtn) {
            this.restartBtn.addEventListener('click', () => this.restartLevel());
        }

        if (this.shuffleBtn) {
            this.shuffleBtn.addEventListener('click', () => shuffleLetters());
        }

        if (this.backToMenuBtn) {
            this.backToMenuBtn.addEventListener('click', () => this.returnToMenu());
        }

        // Menu add coins button — Premium rewarded ad (same as game screen)
        const menuAddCoinsBtn = document.getElementById('menuAddCoinsBtn');
        if (menuAddCoinsBtn) {
            menuAddCoinsBtn.addEventListener('click', () => {
                // Call the premium ad function from game.js
                if (typeof showPremiumRewardAd === 'function') {
                    showPremiumRewardAd();
                } else {
                    // Fallback: open store if function not available
                    const storeOverlay = document.getElementById('storeOverlay');
                    if (storeOverlay) {
                        storeOverlay.classList.add('visible');
                        AudioManager.playWindow();
                    }
                }
            });
        }

        // Daily rewards button listener
        this.dailyRewardsBtn = document.getElementById('dailyRewardsBtn');
        if (this.dailyRewardsBtn) {
            this.dailyRewardsBtn.addEventListener('click', () => this.handleDailyRewards());
        }

        const closeDailyRewardsBtn = document.getElementById('closeDailyRewardsBtn');
        if (closeDailyRewardsBtn) {
            closeDailyRewardsBtn.addEventListener('click', () => this.dailyRewardsOverlay?.classList.remove('visible'));
        }
        // Close on backdrop click
        this.dailyRewardsOverlay?.addEventListener('click', (e) => {
            if (e.target === this.dailyRewardsOverlay) {
                this.dailyRewardsOverlay.classList.remove('visible');
            }
        });

        const claimRewardBtn = document.getElementById('claimRewardBtn');
        if (claimRewardBtn) {
            claimRewardBtn.addEventListener('click', () => this.claimDailyReward());
        }

        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                const action = loginBtn.dataset.action;
                if (action === 'logout') {
                    const auth = await loadAuthService();
                    if (auth) {
                        await auth.signOut();
                        this.updateLoginButton(false);
                    }
                } else {
                    this.hideSettings();
                    this.loginOverlay?.classList.add('visible');
                    AudioManager.playWindow();
                }
            });
        }

        // Menu authorization button
        const menuLoginBtn = document.getElementById('menuLoginBtn');
        if (menuLoginBtn) {
            menuLoginBtn.addEventListener('click', async () => {
                const action = menuLoginBtn.dataset.action;
                if (action === 'logout') {
                    const auth = await loadAuthService();
                    if (auth) {
                        await auth.signOut();
                        this.updateLoginButton(false);
                    }
                } else {
                    this.loginOverlay?.classList.add('visible');
                    AudioManager.playWindow();
                }
            });
        }

        const closeLoginBtn = document.getElementById('closeLoginBtn');
        if (closeLoginBtn) {
            closeLoginBtn.addEventListener('click', () => this.loginOverlay?.classList.remove('visible'));
        }

        // Social Login button listeners
        const googleLoginBtn = document.getElementById('googleLoginBtn');
        if (googleLoginBtn) {
            googleLoginBtn.addEventListener('click', async () => {
                console.log('[App] Google login button clicked');
                this.playSound('clickSound');
                const auth = await loadAuthService();
                if (!auth) {
                    console.log('[App] Auth service not loaded - allowing fallback');
                }
                const success = auth ? await auth.signInWithGoogle() : false;
                console.log('[App] Google login result:', success);
                if (success) {
                    this.loginOverlay?.classList.remove('visible');
                    this.showTemporaryMessage(`გამარჯობა, ${auth?.getUser()?.displayName || 'მომხმარებელო'}!`);
                }
            });
        }


        // Listen for auth events
        window.addEventListener('authCancelled', (e) => {
            console.log('Auth cancelled:', e.detail);
        });

        window.addEventListener('authError', (e) => {
            console.log('Auth error:', e.detail);
            this.showTemporaryMessage('ავტორიზაცია ვერ მოხერხდა. სცადეთ თავიდან.');
        });

        window.addEventListener('userAuthenticated', async (e) => {
            console.log('User authenticated event:', e.detail);
            // Update login button to logout
            this.updateLoginButton(true);
            // Save local progress to cloud
            const auth = await loadAuthService();
            if (auth && auth.saveProgress) {
                await auth.saveProgress();
            }
        });

        // Listen for auth reward received (200 coins)
        window.addEventListener('authRewardReceived', (e) => {
            console.log('Auth reward received:', e.detail);
            // Update coin UI
            const coinCounter = document.getElementById('coin-counter');
            if (coinCounter) {
                coinCounter.textContent = e.detail.coins;
            }
            // Hide the +200 tag on the auth button
            const menuLoginBtn = document.getElementById('menuLoginBtn');
            const authTag = menuLoginBtn?.querySelector('.auth-reward-tag');
            if (authTag) {
                authTag.classList.add('hidden');
            }
            this.showTemporaryMessage('+200 მონეტა! 💎');
        });

        window.addEventListener('userSignedOut', () => {
            console.log('User signed out');
            this.showTemporaryMessage('თქვენ გამოხვერდით სისტემიდან');
            this.updateLoginButton(false);
        });
        
        window.addEventListener('progressRestored', (e) => {
            console.log('Progress restored from cloud:', e.detail);
            this.loadProgress();
            this.maxUnlockedLevel = e.detail.maxUnlockedLevel || this.maxUnlockedLevel;
            this.currentLevelIndex = e.detail.currentLevelIndex || this.currentLevelIndex;
            // Reload game state
            if (typeof updateCoinUI === 'function') {
                updateCoinUI();
            }
            this.showTemporaryMessage('პროგრესი აღდგა ღრუბელიდან!');
        });
        
        // Initial login button state
        this.checkLoginState();

        // საწყისი მონაცემების განახლება
        this.updateAudioUI(); // ხმის აიქონის დაყენება მეხსიერების მიხედვით

        // Loading-ის მოცილება - fallback after 3 seconds
        console.log('[App] Adding hidden class to loading screen...');
        this.loadingScreen.classList.add('hidden');
        console.log('[App] Loading screen classes:', this.loadingScreen.className);
        
        // Safety fallback
        setTimeout(() => {
            const ls = document.getElementById('loadingScreen');
            if (ls && !ls.classList.contains('hidden')) {
                ls.classList.add('hidden');
            }
        }, 3000);
        
        // Initialize the game engine
        initGame();

        // Initialize AdMob with delay to ensure Capacitor is ready
        window.setTimeout(() => {
            console.log('[App] Starting AdMob init...');
            initAdMob().then(() => {
                console.log('[App] AdMob init done');
                attachRewardedVideoListener('getCoinsBtn');
            }).catch(e => {
                console.error('[App] AdMob error:', e);
            });
        }, 1500);

        // Hook victory callback for unlocking and saving progress
        onLevelComplete(async (completedLevel) => {
            console.log('Level completed callback:', completedLevel);
            this.unlockNextLevel(completedLevel);
            this.currentLevelIndex = Math.min(completedLevel + 1, levels.length - 1);
            localStorage.setItem('georgianWordscapes_currentLevel', this.currentLevelIndex);
            
            // Save to cloud
            const auth = await loadAuthService();
            if (auth && auth.saveProgress && auth.getIsAuthenticated()) {
                await auth.saveProgress();
                console.log('[App] Progress synced to cloud');
            }
        });

        // Hook level selected callback for screen transition from level selection overlay
        onLevelSelected((levelIndex) => {
            this.currentLevelIndex = levelIndex;
            localStorage.setItem('georgianWordscapes_currentLevel', this.currentLevelIndex);
            this.mainMenu.classList.remove('active');
            this.gameScreen.classList.add('active');
            this.mainMenu.style.display = 'none';
            this.gameScreen.style.display = 'flex';
        });

        // Apply stored progress
        this.loadProgress();
        
        // Initialize settings UI
        this.updateSettingsUI();
    },
    
    // Login button toggle
    updateLoginButton(isLoggedIn) {
        const loginBtn = document.getElementById('loginBtn');
        const menuLoginBtn = document.getElementById('menuLoginBtn');
        const btn = loginBtn || menuLoginBtn;
        
        if (btn) {
            const textSpan = btn.querySelector('.menu-auth-text, .settings-auth-text');
            if (textSpan) {
                textSpan.textContent = isLoggedIn ? 'გამოსვლა' : 'ავტორიზაცია';
            }
            btn.dataset.action = isLoggedIn ? 'logout' : 'login';
        }
    },
    
    async checkLoginState() {
        const auth = await loadAuthService();
        if (auth && auth.getIsAuthenticated()) {
            this.updateLoginButton(true);
        } else {
            this.updateLoginButton(false);
        }
    },

    // Global Mute button - MASTER SWITCH for all audio
    toggleAudio() {
        this.isAudioOn = !this.isAudioOn;
        // Sync Music & Sound toggles with master audio
        this.isMusicOn = this.isAudioOn;
        this.isSoundOn = this.isAudioOn;
        localStorage.setItem('gameAudio', this.isAudioOn ? 'on' : 'off');
        localStorage.setItem('gameMusic', this.isMusicOn ? 'on' : 'off');
        localStorage.setItem('gameSound', this.isSoundOn ? 'on' : 'off');
        
        // Control the Audio Manager - both sound effects and music
        AudioManager.setEnabled(this.isAudioOn);
        AudioManager.toggleMusic(this.isAudioOn);
        
        // Update ALL THREE button icons to stay synchronized
        this.updateAudioUI();      // Global button
        this.updateSettingsUI();    // Music + Sound buttons in settings
        console.log("Audio is now:", this.isAudioOn ? "ON" : "OFF");
    },

    // ხმის აიქონის ვიზუალური განახლება
    updateAudioUI() {
        if (this.audioIcon) {
            if (this.isAudioOn) {
                this.audioIcon.classList.remove('icon-audio-off');
                this.audioIcon.classList.add('icon-audio-on');
            } else {
                this.audioIcon.classList.remove('icon-audio-on');
                this.audioIcon.classList.add('icon-audio-off');
            }
        }

        if (this.gameAudioIcon) {
            if (this.isAudioOn) {
                this.gameAudioIcon.classList.remove('icon-audio-off');
                this.gameAudioIcon.classList.add('icon-audio-on');
            } else {
                this.gameAudioIcon.classList.remove('icon-audio-on');
                this.gameAudioIcon.classList.add('icon-audio-off');
            }
        }
    },

    // Settings UI update
    updateSettingsUI() {
        // Music toggle
        if (this.musicToggle) {
            if (this.isMusicOn) {
                this.musicToggle.classList.add('active');
                if (this.musicStatus) this.musicStatus.textContent = 'ON';
            } else {
                this.musicToggle.classList.remove('active');
                if (this.musicStatus) this.musicStatus.textContent = 'OFF';
            }
        }
        
        // Sound toggle
        if (this.soundToggle) {
            if (this.isSoundOn) {
                this.soundToggle.classList.add('active');
                if (this.soundStatus) this.soundStatus.textContent = 'ON';
            } else {
                this.soundToggle.classList.remove('active');
                if (this.soundStatus) this.soundStatus.textContent = 'OFF';
            }
        }
    },

    // Music toggle - mutes/plays background music
    toggleMusic() {
        this.isMusicOn = !this.isMusicOn;
        localStorage.setItem('gameMusic', this.isMusicOn ? 'on' : 'off');
        
        // Reset the waiting state and force play if turning on
        if (this.isMusicOn) {
            AudioManager.musicWaitingForInteraction = false;
            AudioManager.loadBackgroundMusic();
            setTimeout(() => {
                AudioManager.resumeBackgroundMusic();
            }, 100);
        } else {
            AudioManager.toggleMusic(false);
        }
        
        this.syncMasterAudio();
        this.updateSettingsUI();
    },

    // Sound toggle - mutes interface sounds
    toggleSound() {
        this.isSoundOn = !this.isSoundOn;
        localStorage.setItem('gameSound', this.isSoundOn ? 'on' : 'off');
        AudioManager.setEnabled(this.isSoundOn);
        this.syncMasterAudio();
        this.updateSettingsUI();
    },

    // Sync master audio button based on Music + Sound state
    syncMasterAudio() {
        this.isAudioOn = this.isMusicOn || this.isSoundOn;
        localStorage.setItem('gameAudio', this.isAudioOn ? 'on' : 'off');
        this.updateAudioUI();
    },

    loadProgress() {
        const storedMax = parseInt(localStorage.getItem('georgianWordscapes_level'), 10);
        this.maxUnlockedLevel = Number.isFinite(storedMax) && !Number.isNaN(storedMax) && storedMax >= 0 && storedMax < levels.length ? storedMax : 0;

        const storedCurrent = parseInt(localStorage.getItem('georgianWordscapes_currentLevel'), 10);
        this.currentLevelIndex = Number.isFinite(storedCurrent) && !Number.isNaN(storedCurrent) && storedCurrent >= 0 && storedCurrent < levels.length ? storedCurrent : this.maxUnlockedLevel;

        if (this.currentLevelIndex > this.maxUnlockedLevel) {
            this.currentLevelIndex = this.maxUnlockedLevel;
        }

        console.log('Progress loaded: currentLevelIndex=', this.currentLevelIndex, 'maxUnlockedLevel=', this.maxUnlockedLevel);
    },

    selectLevel(index) {
        if (index < 0 || index >= levels.length) return;
        if (index > this.maxUnlockedLevel) {
            console.warn('Level locked:', index);
            return;
        }
        this.currentLevelIndex = index;
        localStorage.setItem('georgianWordscapes_currentLevel', this.currentLevelIndex);

        // Start the game immediately after level selection
        this.startGame();
    },

    showSettings() {
        if (this.settingsOverlay) {
            this.settingsOverlay.classList.add('visible');
            AudioManager.playWindow();
        }
    },

    hideSettings() {
        if (this.settingsOverlay) {
            this.settingsOverlay.classList.remove('visible');
        }
    },

    resumeGameFromModal() {
        this.playSound('clickSound');
        this.hideSettings();
    },

    restartLevel() {
        this.playSound('clickSound');
        this.hideSettings();
        initLevel(this.currentLevelIndex);
    },
    resumeGame() {
        if (this.maxUnlockedLevel < 0) {
            AudioManager.playWrong();
            this.showTemporaryMessage('უნდა განბლოკო დონე ჯერ');
            return;
        }

        this.currentLevelIndex = Math.min(this.maxUnlockedLevel, levels.length - 1);
        this.startGame();
    },

    startGame() {
        if (this.maxUnlockedLevel < 0) {
            AudioManager.playWrong();
            this.showTemporaryMessage('უნდა განბლოკო დონე ჯერ');
            return;
        }

        this.mainMenu.classList.remove('active');
        this.gameScreen.classList.add('active');
        this.mainMenu.style.display = 'none';
        this.gameScreen.style.display = 'flex';

        initLevel(this.currentLevelIndex);
    },

    saveProgress() {
        // Save max unlocked and current selection to localStorage
        localStorage.setItem('georgianWordscapes_level', this.maxUnlockedLevel);
        localStorage.setItem('georgianWordscapes_currentLevel', this.currentLevelIndex);
        console.log('Progress saved: currentLevelIndex=', this.currentLevelIndex, 'maxUnlockedLevel=', this.maxUnlockedLevel);
    },

    unlockNextLevel(completedLevel) {
        if (typeof completedLevel !== 'number' || completedLevel < 0) return;

        const best = Math.max(this.maxUnlockedLevel, 0);
        if (completedLevel >= best) {
            const next = Math.min(completedLevel + 1, levels.length - 1);
            this.maxUnlockedLevel = Math.max(this.maxUnlockedLevel, next);
            this.saveProgress();
            this.showTemporaryMessage(`Level ${completedLevel + 1} completed - unlocked level ${next + 1}`);
            
            // Sync to cloud when level unlocks
            this.syncToCloud();
        }
    },
    
    async syncToCloud() {
        const auth = await loadAuthService();
        if (auth && auth.saveProgress && auth.getIsAuthenticated()) {
            await auth.saveProgress();
            console.log('[App] Progress synced to cloud');
        }
    },



    showTemporaryMessage(text) {
        const status = document.getElementById('statusMessage');
        if (!status) return;
        status.textContent = text;
        status.classList.add('visible');
        setTimeout(() => {
            status.classList.remove('visible');
        }, 2500);
    },

    // === DAILY REWARDS — Consecutive Day System (resets if user misses a day) ===

    // Reward schedule for 7 days
    weeklyRewards: [
        { day: 1, coins: 50 },
        { day: 2, coins: 100 },
        { day: 3, coins: 150 },
        { day: 4, coins: 200 },
        { day: 5, coins: 250 },
        { day: 6, coins: 300 },
        { day: 7, coins: 600 },
    ],

    // Get date string for storage (YYYY-MM-DD)
    getDateString() {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    },

    // Load daily reward state from localStorage
    loadWeeklyRewardsState() {
        const stored = localStorage.getItem('georgianWordscapes_dailyRewards');
        if (stored) {
            try {
                const state = JSON.parse(stored);
                const today = this.getDateString();
                const lastClaimDate = state.lastClaimDate;
                
                // Calculate days since last claim
                if (lastClaimDate) {
                    const lastDate = new Date(lastClaimDate);
                    const todayDate = new Date(today);
                    const diffTime = todayDate - lastDate;
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    // If more than 1 day has passed (missed at least one day), reset to day 1
                    if (diffDays > 1) {
                        return {
                            lastClaimDate: null,
                            claimedDays: [],
                            nextDay: 1
                        };
                    }
                    
                    // If exactly 1 day has passed, continue from where left off
                    // If 0 days (same day), continue normally
                }
                return state;
            } catch (e) {
                // Invalid data, reset
            }
        }
        // First time — start fresh
        return {
            lastClaimDate: null,
            claimedDays: [],
            nextDay: 1
        };
    },

    // Save daily reward state to localStorage
    saveWeeklyRewardsState(state) {
        state.lastClaimDate = this.getDateString();
        localStorage.setItem('georgianWordscapes_dailyRewards', JSON.stringify(state));
    },

    // Render the weekly rewards UI based on current state
    renderWeeklyRewards() {
        const state = this.loadWeeklyRewardsState();
        const cards = document.querySelectorAll('.week-day-card');
        const claimBtn = document.getElementById('claimRewardBtn');
        const claimBtnText = document.getElementById('claimBtnText');
        const progressFill = document.getElementById('weeklyProgressFill');

        cards.forEach(card => {
            const day = parseInt(card.dataset.day, 10);
            card.classList.remove('available', 'claimed', 'locked');

            const overlay = card.querySelector('.week-day-overlay');
            if (overlay) {
                overlay.textContent = '';
                // Remove pseudo-element styling by clearing classes
            }

            if (state.claimedDays.includes(day)) {
                card.classList.add('claimed');
            } else if (day === state.nextDay && day <= 7) {
                card.classList.add('available');
            } else {
                card.classList.add('locked');
            }
        });

        // Update progress bar
        if (progressFill) {
            const pct = (state.claimedDays.length / 7) * 100;
            progressFill.style.width = pct + '%';
        }

        // Update claim button
        if (claimBtn && claimBtnText) {
            const todayClaimed = state.claimedDays.includes(state.nextDay);
            const allClaimed = state.nextDay > 7;

            if (allClaimed) {
                claimBtnText.textContent = 'კვირა დასრულებულია!';
                claimBtn.classList.add('claimed-today');
                claimBtn.disabled = true;
            } else if (todayClaimed) {
                claimBtnText.textContent = 'დღეს უკვე აიღე!';
                claimBtn.classList.add('claimed-today');
                claimBtn.disabled = true;
            } else {
                claimBtnText.textContent = 'აიღე';
                claimBtn.classList.remove('claimed-today');
                claimBtn.disabled = false;
            }
        }
    },

// Claim today's reward
    claimDailyReward() {
        const state = this.loadWeeklyRewardsState();
        const today = this.getDateString();

        // Check if already claimed today (same calendar day)
        if (state.lastClaimDate === today) {
            this.showTemporaryMessage('დღეს უკვე აიღე!');
            return;
        }

        // Check if already claimed or week done
        if (state.nextDay > 7) {
            this.showTemporaryMessage('კვირა დასრულებულია!');
            return;
        }
        if (state.claimedDays.includes(state.nextDay)) {
            this.showTemporaryMessage('დღეს უკვე აიღე!');
            return;
        }

        const reward = this.weeklyRewards[state.nextDay - 1];
        if (!reward) return;

        // Get the current day card for coin animation origin
        const card = document.querySelector(`.week-day-card[data-day="${state.nextDay}"]`);
        
        // Mark the card animation
        if (card) {
            card.classList.add('just-claimed');
            setTimeout(() => card.classList.remove('just-claimed'), 600);
        }

        // Day 7 gets special coin explosion effect
        if (state.nextDay === 7) {
            this.spawnSpecialStarCoins(card, () => {
                // Callback after animation: add coins to balance
                gameState.userCoins += reward.coins;
                if (typeof updateCoinUI === 'function') updateCoinUI();
                if (typeof saveCoins === 'function') saveCoins();
                this.showTemporaryMessage(`+${reward.coins} მონეტა! 💎`);
            });
        } else if (reward.coins > 0) {
            this.spawnFlyingCoins(card, reward.coins, () => {
                // Callback after animation: add coins to balance
                gameState.userCoins += reward.coins;
                if (typeof updateCoinUI === 'function') updateCoinUI();
                if (typeof saveCoins === 'function') saveCoins();
                this.showTemporaryMessage(`+${reward.coins} მონეტა! 💎`);
            });
        }

        // Update state
        state.claimedDays.push(state.nextDay);
        state.nextDay++;
        this.saveWeeklyRewardsState(state);

        // Re-render
        this.renderWeeklyRewards();

        // Auto-close the modal
        this.dailyRewardsOverlay?.classList.remove('visible');
        
        // Sync coins to cloud
        this.syncToCloud();
    },

    // Special coin explosion for Day 7 (star day) - biggest and most beautiful effect
    spawnSpecialStarCoins(sourceElement, onComplete) {
        if (!sourceElement) {
            if (onComplete) onComplete();
            return;
        }

        // Get the star icon position
        const starIcon = sourceElement.querySelector('.special-icon-puffy');
        let startX, startY;
        
        if (starIcon) {
            const iconRect = starIcon.getBoundingClientRect();
            startX = iconRect.left + iconRect.width / 2;
            startY = iconRect.top + iconRect.height / 2;
        } else {
            const sourceRect = sourceElement.getBoundingClientRect();
            startX = sourceRect.left + sourceRect.width / 2;
            startY = sourceRect.top + sourceRect.height / 2;
        }

        // Find the actual coin counter position
        let targetX, targetY;
        const coinCounter = document.getElementById('coin-counter');
        if (coinCounter) {
            const counterRect = coinCounter.getBoundingClientRect();
            targetX = counterRect.left + counterRect.width / 2;
            targetY = counterRect.top + counterRect.height / 2;
        } else {
            // Fallback to relative upper right corner
            targetX = window.innerWidth - 100;
            targetY = 80;
        }

        // Day 7 gets LOTS of coins - 15 coins for maximum celebration
        const numCoins = 15;
        
        // Gentle stagger for a majestic burst effect
        const spawnDelay = 100;
        // Very slow, more spectacular and elegant flight
        const flightDuration = 6400;
        // Total animation time
        const totalAnimationTime = spawnDelay * numCoins + flightDuration;

        // Create a burst pattern with coins spreading out
        for (let i = 0; i < numCoins; i++) {
            setTimeout(() => {
                // Create a beautiful spread pattern
                const angle = (i / numCoins) * Math.PI * 2;
                const variationX = Math.cos(angle) * 60 + (Math.random() - 0.5) * 30;
                const variationY = Math.sin(angle) * 40 + (Math.random() - 0.5) * 20;
                
                this.createFlyingCoin(
                    startX, 
                    startY, 
                    targetX + variationX, 
                    targetY + variationY, 
                    flightDuration, 
                    i
                );
            }, i * spawnDelay);
        }

        // Trigger effects after all coins arrive
        setTimeout(() => {
            const coinCounter = document.getElementById('coin-counter');
            if (coinCounter) {
                coinCounter.classList.add('coin-counter-pop');
                setTimeout(() => {
                    coinCounter.classList.remove('coin-counter-pop');
                }, 800);
            }
            
            if (onComplete) onComplete();
        }, totalAnimationTime - 300);
    },

    // Spawn flying coins from source element to upper right corner (coin balance)
    spawnFlyingCoins(sourceElement, coinCount, onComplete) {
        if (!sourceElement) {
            if (onComplete) onComplete();
            return;
        }

        // Coin starts from the coin icon inside the day card
        const coinIcon = sourceElement.querySelector('.coin-icon-puffy, .special-icon-puffy');
        let startX, startY;
        
        if (coinIcon) {
            const iconRect = coinIcon.getBoundingClientRect();
            startX = iconRect.left + iconRect.width / 2;
            startY = iconRect.top + iconRect.height / 2;
        } else {
            const sourceRect = sourceElement.getBoundingClientRect();
            startX = sourceRect.left + sourceRect.width / 2;
            startY = sourceRect.top + sourceRect.height / 2;
        }

        // Find the actual coin counter position
        let targetX, targetY;
        const coinCounter = document.getElementById('coin-counter');
        if (coinCounter) {
            const counterRect = coinCounter.getBoundingClientRect();
            targetX = counterRect.left + counterRect.width / 2;
            targetY = counterRect.top + counterRect.height / 2;
        } else {
            // Fallback to relative upper right corner
            targetX = window.innerWidth - 100;
            targetY = 80;
        }

        // Minimum 4 coins, maximum 10, with closer spacing for gentle effect
        const numCoins = Math.max(4, Math.min(10, Math.ceil(coinCount / 3)));
        
        // Gentle stagger for soft, flowing effect
        const spawnDelay = 160;
        // Very slow, more pleasant and graceful flight
        const flightDuration = 5600;
        // Total animation time
        const totalAnimationTime = spawnDelay * numCoins + flightDuration;

        for (let i = 0; i < numCoins; i++) {
            setTimeout(() => {
                // Pass target position for each coin with slight variation
                const variationX = (Math.random() - 0.5) * 40;
                const variationY = (Math.random() - 0.5) * 20;
                this.createFlyingCoin(startX, startY, targetX + variationX, targetY + variationY, flightDuration, i);
            }, i * spawnDelay);
        }

        // Trigger effects after all coins arrive
        setTimeout(() => {
            // Find and animate the coin counter
            const coinCounter = document.getElementById('coin-counter');
            if (coinCounter) {
                coinCounter.classList.add('coin-counter-pop');
                setTimeout(() => {
                    coinCounter.classList.remove('coin-counter-pop');
                }, 600);
            }
            
            // Play coin collect sound when coins arrive
            AudioManager.playCoin();
            
            if (onComplete) onComplete();
        }, totalAnimationTime - 300);
    },

    // Create a single flying coin element with beautiful arc animation
    createFlyingCoin(startX, startY, targetX, targetY, duration, index = 0) {
        const coin = document.createElement('div');
        coin.className = 'flying-coin';
        coin.style.left = `${startX - 14}px`;
        coin.style.top = `${startY - 14}px`;
        document.body.appendChild(coin);

        // Calculate control points for a beautiful high arc
        const midX = (startX + targetX) / 2;
        // Arc goes significantly higher than both points
        const arcHeight = Math.max(250, Math.abs(targetX - startX) * 0.6);
        const controlX = midX + (index % 2 === 0 ? 30 : -30); // Alternating curve direction
        const controlY = Math.min(startY, targetY) - arcHeight;

        // Cubic bezier curve interpolation for smoother motion
        const animate = (progress) => {
            const t = progress;
            const invT = 1 - t;
            
            // Cubic bezier: P = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
            const x = invT * invT * invT * startX + 3 * invT * invT * t * controlX + 3 * invT * t * t * controlX + t * t * t * targetX;
            const y = invT * invT * invT * startY + 3 * invT * invT * t * controlY + 3 * invT * t * t * controlY + t * t * t * targetY;
            
            // Gentle organic wobble
            const wobbleX = Math.sin(t * Math.PI * 1.5 + index) * 6 * (1 - t);
            const wobbleY = Math.cos(t * Math.PI * 2 + index) * 4 * (1 - t);

            // Smooth scaling - starts normal, shrinks at end
            const scale = t < 0.7 ? 1 : 1 - ((t - 0.7) / 0.3) * 0.5;
            // Gentle rotation
            const rotation = t * 540;

            // Opacity fades out in the last 20%
            const opacity = t > 0.8 ? 1 - ((t - 0.8) / 0.2) : 1;

            coin.style.left = `${x - 14 + wobbleX}px`;
            coin.style.top = `${y - 14 + wobbleY}px`;
            coin.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
            coin.style.opacity = opacity;
        };

        // Animation using requestAnimationFrame with smooth easing
        const startTime = performance.now();
        
        const animateFrame = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth ease out quint
            const easedProgress = 1 - Math.pow(1 - progress, 5);
            
            animate(easedProgress);

            if (progress < 1) {
                requestAnimationFrame(animateFrame);
            } else {
                coin.remove();
            }
        };

        requestAnimationFrame(animateFrame);

        // Create beautiful trail particles
        this.createCoinTrail(startX, startY, targetX, targetY, duration, coin);
    },

    // Create trail particles behind flying coin
    createCoinTrail(startX, startY, targetX, targetY, duration, coin) {
        const trailInterval = 80;
        let trailCount = 0;
        const maxTrails = Math.floor(duration / trailInterval);

        const createTrail = () => {
            if (trailCount >= maxTrails || !coin.isConnected) return;
            
            const trail = document.createElement('div');
            trail.className = 'flying-coin-trail';
            
            const coinRect = coin.getBoundingClientRect();
            trail.style.left = `${coinRect.left + 10}px`;
            trail.style.top = `${coinRect.top + 10}px`;
            
            document.body.appendChild(trail);

            setTimeout(() => {
                trail.style.transition = 'opacity 1.6s ease-out, transform 1.6s ease-out';
                trail.style.opacity = '0';
                trail.style.transform = 'scale(0.1)';
                setTimeout(() => trail.remove(), 1600);
            }, 10);

            trailCount++;
        };

        const trailTimer = setInterval(createTrail, trailInterval);
        setTimeout(() => clearInterval(trailTimer), duration);
    },

    // Setup listeners for App Pause/Resume (Capacitor)
    setupAppStateListeners() {
        if (typeof CapacitorApp !== 'undefined') {
            CapacitorApp.addListener('appStateChange', ({ isActive }) => {
                console.log('[App] State changed, isActive:', isActive);
                if (!isActive) {
                    // App went to background, pause background music
                    AudioManager.pauseBackgroundMusic();
                } else {
                    // App came back to foreground, resume if music setting is ON
                    if (this.isMusicOn) {
                        AudioManager.resumeBackgroundMusic();
                    }
                }
            });
        }
    },

    // Create ambient floating particles for premium feel
    createAmbientParticles() {
        const container = document.getElementById('bgParticles');
        if (!container) return;

        const particleCount = 20;
        const colors = ['rgba(255, 215, 0, 0.4)', 'rgba(255, 107, 53, 0.3)', 'rgba(255, 255, 255, 0.2)'];

        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            particle.style.width = `${3 + Math.random() * 5}px`;
            particle.style.height = particle.style.width;
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];
            particle.style.animationDelay = `${Math.random() * 8}s`;
            particle.style.animationDuration = `${6 + Math.random() * 6}s`;
            container.appendChild(particle);
        }
    },

    handleDailyRewards() {
        this.playSound('clickSound');
        this.renderWeeklyRewards();
        this.dailyRewardsOverlay?.classList.add('visible');
        AudioManager.playWindow();
    },

    playSound(soundId) {
        if (this.isSoundOn) {
            const sound = document.getElementById(soundId);
            if (sound) {
                sound.play();
            }
        }
    },

    returnToMenu() {
        this.hideSettings(); // Close the settings modal
        this.gameScreen.classList.remove('active');
        this.mainMenu.classList.add('active');
        this.gameScreen.style.display = 'none';
        this.mainMenu.style.display = 'flex';
    },


};

// სტარტი
window.addEventListener('error', (e) => {
    console.error('Global error:', e.message, e.filename, e.lineno);
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.classList.add('hidden');
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    const loading = document.getElementById('loadingScreen');
    if (loading) loading.classList.add('hidden');
});

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}