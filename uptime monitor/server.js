const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const cron = require('node-cron');
const http = require('http');
const socketIo = require('socket.io');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Veritabanı bağlantı havuzu
const dbPool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'Tameralb567',
    database: process.env.DB_NAME || 'uptime',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z'
});

// Socket.IO bağlantıları
const connectedClients = new Map();

io.on('connection', (socket) => {
    console.log('Yeni client bağlandı:', socket.id);
    
    socket.on('register', (data) => {
        connectedClients.set(socket.id, data);
    });
    
    socket.on('disconnect', () => {
        connectedClients.delete(socket.id);
        console.log('Client bağlantısı kesildi:', socket.id);
    });
});

// Bot ping endpoint'i
app.post('/api/bot/ping', async (req, res) => {
    try {
        const { botName, status, message, source = 'vds' } = req.body;
        
        if (!botName) {
            return res.status(400).json({ error: 'Bot adı gerekli' });
        }

        const connection = await dbPool.getConnection();
        
        try {
            // Bot kaydını kontrol et veya oluştur
            const [botRows] = await connection.execute(
                'SELECT id, status FROM bots WHERE name = ?',
                [botName]
            );
            
            let botId;
            let previousStatus = null;
            
            if (botRows.length === 0) {
                // Yeni bot kaydı oluştur
                const [result] = await connection.execute(
                    'INSERT INTO bots (name, status, last_ping, main_file) VALUES (?, ?, NOW(), ?)',
                    [botName, status || 'online', `${botName}.js`]
                );
                botId = result.insertId;
            } else {
                // Mevcut bot kaydını güncelle
                botId = botRows[0].id;
                previousStatus = botRows[0].status;
                
                await connection.execute(
                    'UPDATE bots SET status = ?, last_ping = NOW() WHERE id = ?',
                    [status || 'online', botId]
                );
            }
            
            // Durum geçmişi kaydet
            await connection.execute(
                'INSERT INTO bot_status_history (bot_id, status, message, source) VALUES (?, ?, ?, ?)',
                [botId, status || 'online', message || 'Ping received', source]
            );
            
            // Durum değişikliği varsa bildirim gönder
            if (previousStatus && previousStatus !== (status || 'online')) {
                await sendStatusChangeNotification(connection, botId, botName, status || 'online', previousStatus);
            }
            
            // Gerçek zamanlı güncelleme gönder
            io.emit('botStatusUpdate', {
                botId,
                botName,
                status: status || 'online',
                timestamp: new Date().toISOString(),
                source
            });
            
            res.json({ 
                success: true, 
                botId,
                message: 'Ping başarılı'
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Bot ping hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Bot durumu sorgulama endpoint'i
app.get('/api/bots', async (req, res) => {
    try {
        const connection = await dbPool.getConnection();
        
        try {
            const [rows] = await connection.execute(`
                SELECT 
                    b.*,
                    (SELECT COUNT(*) FROM bot_status_history bsh 
                     WHERE bsh.bot_id = b.id AND bsh.timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)) as ping_count_24h
                FROM bots b
                ORDER BY b.last_ping DESC
            `);
            
            res.json(rows);
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Bot listesi hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Bot detay endpoint'i
app.get('/api/bot/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const connection = await dbPool.getConnection();
        
        try {
            const [botRows] = await connection.execute(
                'SELECT * FROM bots WHERE id = ?',
                [id]
            );
            
            if (botRows.length === 0) {
                return res.status(404).json({ error: 'Bot bulunamadı' });
            }
            
            const [historyRows] = await connection.execute(
                'SELECT * FROM bot_status_history WHERE bot_id = ? ORDER BY timestamp DESC LIMIT 100',
                [id]
            );
            
            const [filesRows] = await connection.execute(
                'SELECT * FROM bot_files WHERE bot_id = ?',
                [id]
            );
            
            res.json({
                bot: botRows[0],
                history: historyRows,
                files: filesRows
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Bot detay hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Profil oluşturma endpoint'i
app.post('/api/profiles', async (req, res) => {
    try {
        const { name, description, botPermissions, notificationEnabled } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Profil adı gerekli' });
        }
        
        const accessKey = crypto.randomBytes(32).toString('hex');
        const connection = await dbPool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Profil oluştur
            const [result] = await connection.execute(
                'INSERT INTO profiles (name, description, access_key, notification_enabled) VALUES (?, ?, ?, ?)',
                [name, description || '', accessKey, notificationEnabled || true]
            );
            
            const profileId = result.insertId;
            
            // Bot izinlerini ekle
            if (botPermissions && Array.isArray(botPermissions)) {
                for (const permission of botPermissions) {
                    await connection.execute(
                        `INSERT INTO profile_bot_permissions 
                         (profile_id, bot_id, can_view, can_edit, can_start_stop, can_restart, receive_notifications) 
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            profileId,
                            permission.botId,
                            permission.canView || true,
                            permission.canEdit || false,
                            permission.canStartStop || false,
                            permission.canRestart || false,
                            permission.receiveNotifications || true
                        ]
                    );
                }
            }
            
            await connection.commit();
            
            res.json({
                success: true,
                profileId,
                accessKey,
                message: 'Profil başarıyla oluşturuldu'
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Profil oluşturma hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Key ile profil doğrulama endpoint'i
app.post('/api/auth/verify-key', async (req, res) => {
    try {
        const { accessKey } = req.body;
        
        if (!accessKey) {
            return res.status(400).json({ error: 'Access key gerekli' });
        }
        
        const connection = await dbPool.getConnection();
        
        try {
            const [profileRows] = await connection.execute(
                'SELECT * FROM profiles WHERE access_key = ?',
                [accessKey]
            );
            
            if (profileRows.length === 0) {
                return res.status(401).json({ error: 'Geçersiz access key' });
            }
            
            const profile = profileRows[0];
            
            // Profil ile ilişkili botları getir
            const [botRows] = await connection.execute(`
                SELECT 
                    b.*,
                    pbp.can_view,
                    pbp.can_edit,
                    pbp.can_start_stop,
                    pbp.can_restart,
                    pbp.receive_notifications
                FROM bots b
                INNER JOIN profile_bot_permissions pbp ON b.id = pbp.bot_id
                WHERE pbp.profile_id = ?
            `, [profile.id]);
            
            res.json({
                success: true,
                profile: {
                    id: profile.id,
                    name: profile.name,
                    description: profile.description,
                    notificationEnabled: profile.notification_enabled
                },
                bots: botRows
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Key doğrulama hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Bot dosyası güncelleme endpoint'i
app.post('/api/bot/:id/files', async (req, res) => {
    try {
        const { id } = req.params;
        const { files } = req.body;
        
        if (!files || !Array.isArray(files)) {
            return res.status(400).json({ error: 'Dosya listesi gerekli' });
        }
        
        const connection = await dbPool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            // Mevcut dosyaları sil
            await connection.execute(
                'DELETE FROM bot_files WHERE bot_id = ?',
                [id]
            );
            
            // Yeni dosyaları ekle
            for (const file of files) {
                const fileHash = crypto.createHash('sha256').update(file.content).digest('hex');
                
                await connection.execute(
                    'INSERT INTO bot_files (bot_id, file_path, file_name, file_content, file_hash) VALUES (?, ?, ?, ?, ?)',
                    [id, file.path, file.name, file.content, fileHash]
                );
            }
            
            await connection.commit();
            
            // Raspberry Pi'ye güncelleme sinyali gönder
            io.emit('fileUpdate', {
                botId: id,
                timestamp: new Date().toISOString()
            });
            
            res.json({
                success: true,
                message: 'Dosyalar başarıyla güncellendi'
            });
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Dosya güncelleme hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Bot kontrol endpoint'i (başlat/durdur)
app.post('/api/bot/:id/control', async (req, res) => {
    try {
        const { id } = req.params;
        const { action, source = 'manual' } = req.body;
        
        if (!['start', 'stop', 'restart'].includes(action)) {
            return res.status(400).json({ error: 'Geçersiz aksiyon' });
        }
        
        const connection = await dbPool.getConnection();
        
        try {
            const [botRows] = await connection.execute(
                'SELECT * FROM bots WHERE id = ?',
                [id]
            );
            
            if (botRows.length === 0) {
                return res.status(404).json({ error: 'Bot bulunamadı' });
            }
            
            const bot = botRows[0];
            
            // Raspberry Pi'ye kontrol sinyali gönder
            io.emit('botControl', {
                botId: id,
                botName: bot.name,
                action,
                timestamp: new Date().toISOString()
            });
            
            // Durum geçmişi kaydet
            await connection.execute(
                'INSERT INTO bot_status_history (bot_id, status, message, source) VALUES (?, ?, ?, ?)',
                [id, action === 'start' ? 'online' : 'offline', `Bot ${action} komutu verildi`, source]
            );
            
            res.json({
                success: true,
                message: `Bot ${action} komutu gönderildi`
            });
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Bot kontrol hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Raspberry Pi heartbeat endpoint'i
app.post('/api/raspberry/heartbeat', async (req, res) => {
    try {
        const { name, ipAddress, cpuUsage, memoryUsage, diskUsage, runningBots } = req.body;
        
        const connection = await dbPool.getConnection();
        
        try {
            await connection.execute(
                `INSERT INTO raspberry_status (name, ip_address, last_heartbeat, status, cpu_usage, memory_usage, disk_usage, running_bots)
                 VALUES (?, ?, NOW(), 'online', ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                 ip_address = VALUES(ip_address),
                 last_heartbeat = NOW(),
                 status = 'online',
                 cpu_usage = VALUES(cpu_usage),
                 memory_usage = VALUES(memory_usage),
                 disk_usage = VALUES(disk_usage),
                 running_bots = VALUES(running_bots)`,
                [name, ipAddress, cpuUsage, memoryUsage, diskUsage, JSON.stringify(runningBots || [])]
            );
            
            res.json({ success: true });
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Raspberry heartbeat hatası:', error);
        res.status(500).json({ error: 'Sunucu hatası' });
    }
});

// Bildirim gönderme fonksiyonu
async function sendStatusChangeNotification(connection, botId, botName, newStatus, oldStatus) {
    try {
        // Bot ile ilişkili profilleri getir
        const [profileRows] = await connection.execute(`
            SELECT DISTINCT p.id, p.name, p.notification_enabled, p.notification_token
            FROM profiles p
            INNER JOIN profile_bot_permissions pbp ON p.id = pbp.profile_id
            WHERE pbp.bot_id = ? AND pbp.receive_notifications = true AND p.notification_enabled = true
        `, [botId]);
        
        for (const profile of profileRows) {
            // Bildirim kaydı oluştur
            await connection.execute(
                'INSERT INTO notifications (profile_id, bot_id, title, message, type) VALUES (?, ?, ?, ?, ?)',
                [
                    profile.id,
                    botId,
                    `Bot Durum Değişikliği: ${botName}`,
                    `${botName} botu ${oldStatus} durumundan ${newStatus} durumuna geçti.`,
                    newStatus === 'crashed' ? 'bot_crash' : newStatus === 'offline' ? 'bot_offline' : 'info'
                ]
            );
            
            // Mobil bildirimi gönder (eğer token varsa)
            if (profile.notification_token) {
                // Push notification gönderme kodu buraya gelecek
                // Firebase veya başka bir push notification servisi kullanılabilir
            }
        }
        
        // WebSocket ile gerçek zamanlı bildirim gönder
        io.emit('notification', {
            botId,
            botName,
            newStatus,
            oldStatus,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Bildirim gönderme hatası:', error);
    }
}

// Çevrimdışı botları kontrol etme cron job'ı (her 1 dakikada bir)
cron.schedule('*/1 * * * *', async () => {
    try {
        const connection = await dbPool.getConnection();
        
        try {
            // 2 dakikadan fazla ping atmayan botları çevrimdışı yap
            const [offlineBots] = await connection.execute(`
                UPDATE bots 
                SET status = 'offline' 
                WHERE status != 'offline' 
                AND last_ping < DATE_SUB(NOW(), INTERVAL 2 MINUTE)
            `);
            
            if (offlineBots.affectedRows > 0) {
                console.log(`${offlineBots.affectedRows} bot çevrimdışı olarak işaretlendi`);
            }
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Çevrimdışı bot kontrolü hatası:', error);
    }
});

// Raspberry Pi durumunu kontrol etme cron job'ı (her 30 saniyede bir)
cron.schedule('*/30 * * * * *', async () => {
    try {
        const connection = await dbPool.getConnection();
        
        try {
            // 1 dakikadan fazla heartbeat atmayan Raspberry Pi'leri çevrimdışı yap
            await connection.execute(`
                UPDATE raspberry_status 
                SET status = 'offline' 
                WHERE status != 'offline' 
                AND last_heartbeat < DATE_SUB(NOW(), INTERVAL 1 MINUTE)
            `);
            
        } finally {
            connection.release();
        }
        
    } catch (error) {
        console.error('Raspberry Pi durum kontrolü hatası:', error);
    }
});

// Hata yakalama middleware
app.use((error, req, res, next) => {
    console.error('Sunucu hatası:', error);
    res.status(500).json({ error: 'Sunucu hatası' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint bulunamadı' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
    console.log(`Uptime Monitor sunucusu ${PORT} portunda çalışıyor`);
});

module.exports = app;