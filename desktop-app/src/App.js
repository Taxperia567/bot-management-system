import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import BotList from './components/BotList';
import ProfileManager from './components/ProfileManager';
import BotEditor from './components/BotEditor';
import Settings from './components/Settings';
import RaspberryConnection from './components/RaspberryConnection';
import StatusBar from './components/StatusBar';
import './App.css';

const API_BASE_URL = 'http://localhost:3001/api';

function App() {
    const [currentView, setCurrentView] = useState('bots');
    const [bots, setBots] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [selectedBot, setSelectedBot] = useState(null);
    const [socket, setSocket] = useState(null);
    const [serverStatus, setServerStatus] = useState('disconnected');
    const [settings, setSettings] = useState({});

    useEffect(() => {
        initializeApp();
        setupElectronListeners();
        connectToServer();

        return () => {
            if (socket) {
                socket.disconnect();
            }
            cleanupElectronListeners();
        };
    }, []);

    const initializeApp = async () => {
        try {
            // Ayarları yükle
            const savedSettings = await window.electronAPI.getStoreValue('settings') || {};
            setSettings(savedSettings);

            // Botları yükle
            await loadBots();
        } catch (error) {
            console.error('Uygulama başlatma hatası:', error);
        }
    };

    const setupElectronListeners = () => {
        window.electronAPI.onBotDirectorySelected((event, path) => {
            console.log('Bot klasörü seçildi:', path);
            loadLocalBots();
        });

        window.electronAPI.onFileChanged((event, filePath) => {
            console.log('Dosya değişti:', filePath);
            handleFileChange(filePath);
        });

        window.electronAPI.onBotsScanned((event, scannedBots) => {
            console.log('Botlar tarandı:', scannedBots);
            updateLocalBots(scannedBots);
        });

        window.electronAPI.onOpenSettings(() => {
            setCurrentView('settings');
        });

        window.electronAPI.onRefreshBots(() => {
            loadBots();
        });

        window.electronAPI.onOpenRaspberryConnection(() => {
            setCurrentView('raspberry');
        });

        window.electronAPI.onSyncStarted(() => {
            console.log('Senkronizasyon başladı');
        });

        window.electronAPI.onSyncCompleted(() => {
            console.log('Senkronizasyon tamamlandı');
        });

        window.electronAPI.onSyncError((event, error) => {
            console.error('Senkronizasyon hatası:', error);
        });
    };

    const cleanupElectronListeners = () => {
        window.electronAPI.removeAllListeners('bot-directory-selected');
        window.electronAPI.removeAllListeners('file-changed');
        window.electronAPI.removeAllListeners('bots-scanned');
        window.electronAPI.removeAllListeners('open-settings');
        window.electronAPI.removeAllListeners('refresh-bots');
        window.electronAPI.removeAllListeners('open-raspberry-connection');
        window.electronAPI.removeAllListeners('sync-started');
        window.electronAPI.removeAllListeners('sync-completed');
        window.electronAPI.removeAllListeners('sync-error');
    };

    const connectToServer = () => {
        const socketConnection = io('http://localhost:3001');
        
        socketConnection.on('connect', () => {
            console.log('Sunucuya bağlandı');
            setServerStatus('connected');
            setSocket(socketConnection);
        });

        socketConnection.on('disconnect', () => {
            console.log('Sunucu bağlantısı kesildi');
            setServerStatus('disconnected');
        });

        socketConnection.on('botStatusUpdate', (data) => {
            console.log('Bot durumu güncellendi:', data);
            updateBotStatus(data);
        });

        socketConnection.on('notification', (data) => {
            console.log('Bildirim alındı:', data);
            showNotification(data);
        });
    };

    const loadBots = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/bots`);
            setBots(response.data);
        } catch (error) {
            console.error('Bot listesi yükleme hatası:', error);
        }
    };

    const loadLocalBots = async () => {
        try {
            const localBots = await window.electronAPI.scanBots();
            updateLocalBots(localBots);
        } catch (error) {
            console.error('Yerel bot tarama hatası:', error);
        }
    };

    const updateLocalBots = (localBots) => {
        // Yerel botları sunucu botlarıyla birleştir
        setBots(prevBots => {
            const updatedBots = [...prevBots];
            
            localBots.forEach(localBot => {
                const existingBotIndex = updatedBots.findIndex(bot => bot.name === localBot.name);
                
                if (existingBotIndex >= 0) {
                    // Mevcut botu güncelle
                    updatedBots[existingBotIndex] = {
                        ...updatedBots[existingBotIndex],
                        localPath: localBot.path,
                        localFiles: localBot.files
                    };
                } else {
                    // Yeni bot ekle
                    updatedBots.push({
                        name: localBot.name,
                        status: 'offline',
                        localPath: localBot.path,
                        localFiles: localBot.files,
                        main_file: localBot.mainFile
                    });
                }
            });
            
            return updatedBots;
        });
    };

    const updateBotStatus = (statusUpdate) => {
        setBots(prevBots => 
            prevBots.map(bot => 
                bot.id === statusUpdate.botId || bot.name === statusUpdate.botName
                    ? { ...bot, status: statusUpdate.status, last_ping: statusUpdate.timestamp }
                    : bot
            )
        );
    };

    const handleFileChange = async (filePath) => {
        // Dosya değişikliklerini işle
        try {
            const content = await window.electronAPI.readFile(filePath);
            console.log('Dosya içeriği güncellendi:', filePath);
            
            // Eğer seçili bot ile ilgili dosya ise, editörü güncelle
            if (selectedBot && selectedBot.localPath && filePath.startsWith(selectedBot.localPath)) {
                // Bot editörünü güncelle
                setSelectedBot(prevBot => ({
                    ...prevBot,
                    needsRefresh: true
                }));
            }
        } catch (error) {
            console.error('Dosya okuma hatası:', error);
        }
    };

    const showNotification = (notification) => {
        // Bildirim göster
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title || 'Bot Bildirimi', {
                body: notification.message || notification.botName + ' durumu değişti',
                icon: '/icon.png'
            });
        }
    };

    const handleBotSelect = (bot) => {
        setSelectedBot(bot);
        setCurrentView('editor');
    };

    const handleBotControl = async (botId, action) => {
        try {
            await axios.post(`${API_BASE_URL}/bot/${botId}/control`, {
                action,
                source: 'desktop'
            });
        } catch (error) {
            console.error('Bot kontrol hatası:', error);
        }
    };

    const handleFileSave = async (botId, files) => {
        try {
            await axios.post(`${API_BASE_URL}/bot/${botId}/files`, {
                files
            });
            
            // Yerel dosyaları da kaydet
            if (selectedBot && selectedBot.localPath) {
                for (const file of files) {
                    const filePath = `${selectedBot.localPath}/${file.name}`;
                    await window.electronAPI.writeFile(filePath, file.content);
                }
            }
        } catch (error) {
            console.error('Dosya kaydetme hatası:', error);
        }
    };

    const renderCurrentView = () => {
        switch (currentView) {
            case 'bots':
                return (
                    <BotList
                        bots={bots}
                        onBotSelect={handleBotSelect}
                        onBotControl={handleBotControl}
                        onRefresh={loadBots}
                    />
                );
            case 'profiles':
                return (
                    <ProfileManager
                        profiles={profiles}
                        bots={bots}
                        onProfileCreate={() => loadBots()}
                    />
                );
            case 'editor':
                return selectedBot ? (
                    <BotEditor
                        bot={selectedBot}
                        onSave={handleFileSave}
                        onBack={() => setCurrentView('bots')}
                    />
                ) : null;
            case 'settings':
                return (
                    <Settings
                        settings={settings}
                        onSettingsChange={setSettings}
                        onBack={() => setCurrentView('bots')}
                    />
                );
            case 'raspberry':
                return (
                    <RaspberryConnection
                        onBack={() => setCurrentView('bots')}
                    />
                );
            default:
                return <BotList bots={bots} onBotSelect={handleBotSelect} />;
        }
    };

    return (
        <div className="app">
            <header className="app-header">
                <div className="app-title">
                    <h1>Bot Management System</h1>
                </div>
                <nav className="app-nav">
                    <button 
                        className={currentView === 'bots' ? 'active' : ''}
                        onClick={() => setCurrentView('bots')}
                    >
                        Botlar
                    </button>
                    <button 
                        className={currentView === 'profiles' ? 'active' : ''}
                        onClick={() => setCurrentView('profiles')}
                    >
                        Profiller
                    </button>
                    <button 
                        className={currentView === 'settings' ? 'active' : ''}
                        onClick={() => setCurrentView('settings')}
                    >
                        Ayarlar
                    </button>
                    <button 
                        className={currentView === 'raspberry' ? 'active' : ''}
                        onClick={() => setCurrentView('raspberry')}
                    >
                        Raspberry Pi
                    </button>
                </nav>
            </header>

            <main className="app-main">
                {renderCurrentView()}
            </main>

            <StatusBar 
                serverStatus={serverStatus}
                botCount={bots.length}
                onlineBotCount={bots.filter(bot => bot.status === 'online').length}
            />
        </div>
    );
}

export default App;