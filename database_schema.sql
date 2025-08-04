-- ============================================
-- Bot Management System Database Schema
-- MariaDB 10.5+ Compatible
-- Created: 2025-08-04
-- ============================================

-- Veritabanı oluşturma
CREATE DATABASE IF NOT EXISTS bot_management_system 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE bot_management_system;

-- ============================================
-- Ana Tablolar
-- ============================================

-- Botlar tablosu
CREATE TABLE bots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    description TEXT,
    main_file VARCHAR(255) NOT NULL,
    status ENUM('online', 'offline', 'crashed', 'maintenance', 'starting', 'stopping') DEFAULT 'offline',
    last_ping TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Dosya yolları
    vds_path VARCHAR(500),
    raspberry_path VARCHAR(500),
    working_directory VARCHAR(500),
    
    -- Konfigürasyon
    auto_restart BOOLEAN DEFAULT TRUE,
    restart_delay INT DEFAULT 5,
    max_restart_attempts INT DEFAULT 3,
    priority INT DEFAULT 1,
    memory_limit INT DEFAULT 512,
    cpu_limit INT DEFAULT 100,
    
    -- İstatistikler
    total_uptime_seconds BIGINT DEFAULT 0,
    crash_count INT DEFAULT 0,
    restart_count INT DEFAULT 0,
    last_crash_time TIMESTAMP NULL,
    
    -- Metadata
    version VARCHAR(50),
    node_version VARCHAR(50),
    discord_js_version VARCHAR(50),
    
    INDEX idx_bots_status (status),
    INDEX idx_bots_last_ping (last_ping),
    INDEX idx_bots_priority (priority)
);

-- Profiller tablosu
CREATE TABLE profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    access_key VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Bildirim ayarları
    notification_enabled BOOLEAN DEFAULT TRUE,
    notification_token VARCHAR(255),
    email VARCHAR(255),
    discord_user_id VARCHAR(20),
    
    -- Güvenlik
    last_login TIMESTAMP NULL,
    login_count INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    role ENUM('admin', 'moderator', 'viewer') DEFAULT 'viewer',
    
    INDEX idx_profiles_access_key (access_key),
    INDEX idx_profiles_active (is_active)
);

-- Profil-Bot izinleri tablosu
CREATE TABLE profile_bot_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    bot_id INT NOT NULL,
    
    -- İzinler
    can_view BOOLEAN DEFAULT TRUE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_start_stop BOOLEAN DEFAULT FALSE,
    can_restart BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_view_logs BOOLEAN DEFAULT TRUE,
    can_edit_files BOOLEAN DEFAULT FALSE,
    can_manage_settings BOOLEAN DEFAULT FALSE,
    
    -- Bildirim izinleri
    receive_notifications BOOLEAN DEFAULT TRUE,
    receive_crash_alerts BOOLEAN DEFAULT TRUE,
    receive_offline_alerts BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    UNIQUE KEY unique_profile_bot (profile_id, bot_id),
    INDEX idx_permissions_profile (profile_id),
    INDEX idx_permissions_bot (bot_id)
);

-- Bot durumu geçmişi
CREATE TABLE bot_status_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bot_id INT NOT NULL,
    status ENUM('online', 'offline', 'crashed', 'maintenance', 'starting', 'stopping'),
    previous_status ENUM('online', 'offline', 'crashed', 'maintenance', 'starting', 'stopping'),
    message TEXT,
    error_details JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source ENUM('vds', 'raspberry', 'manual', 'system') DEFAULT 'vds',
    duration_seconds INT,
    
    -- Performance metrics
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    memory_usage_mb INT,
    
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    INDEX idx_status_history_bot_id (bot_id),
    INDEX idx_status_history_timestamp (timestamp),
    INDEX idx_status_history_status (status),
    INDEX idx_status_history_source (source)
);

-- Bot dosyaları tablosu
CREATE TABLE bot_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bot_id INT NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_content LONGTEXT,
    file_hash VARCHAR(64),
    file_size INT DEFAULT 0,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Metadata
    file_type ENUM('js', 'json', 'txt', 'md', 'env', 'other') DEFAULT 'other',
    is_main_file BOOLEAN DEFAULT FALSE,
    is_config_file BOOLEAN DEFAULT FALSE,
    encoding VARCHAR(20) DEFAULT 'utf-8',
    
    -- Versioning
    version INT DEFAULT 1,
    previous_hash VARCHAR(64),
    
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    UNIQUE KEY unique_bot_file_path (bot_id, file_path),
    INDEX idx_files_bot_id (bot_id),
    INDEX idx_files_hash (file_hash),
    INDEX idx_files_modified (last_modified)
);

-- Sistem logları
CREATE TABLE system_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    log_level ENUM('debug', 'info', 'warning', 'error', 'critical') DEFAULT 'info',
    message TEXT NOT NULL,
    component ENUM('uptime_monitor', 'desktop_app', 'mobile_app', 'raspberry', 'database', 'auth') NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Context
    bot_id INT NULL,
    profile_id INT NULL,
    request_id VARCHAR(36),
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Additional data
    additional_data JSON,
    stack_trace TEXT,
    
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE SET NULL,
    INDEX idx_logs_level (log_level),
    INDEX idx_logs_component (component),
    INDEX idx_logs_timestamp (timestamp),
    INDEX idx_logs_bot_id (bot_id)
);

-- Bildirimler tablosu
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    bot_id INT,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('bot_crash', 'bot_offline', 'bot_online', 'system_error', 'info', 'warning') DEFAULT 'info',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    sent_at TIMESTAMP NULL,
    
    -- Delivery
    delivery_method ENUM('push', 'email', 'discord', 'webhook') DEFAULT 'push',
    delivery_status ENUM('pending', 'sent', 'failed', 'delivered') DEFAULT 'pending',
    delivery_attempts INT DEFAULT 0,
    next_retry_at TIMESTAMP NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE SET NULL,
    INDEX idx_notifications_profile_id (profile_id),
    INDEX idx_notifications_read (is_read),
    INDEX idx_notifications_created_at (created_at),
    INDEX idx_notifications_type (type),
    INDEX idx_notifications_priority (priority)
);

-- Raspberry Pi durumu
CREATE TABLE raspberry_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    hostname VARCHAR(255),
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    
    -- Status
    status ENUM('online', 'offline', 'maintenance') DEFAULT 'offline',
    last_heartbeat TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- System info
    os_version VARCHAR(100),
    python_version VARCHAR(20),
    disk_total_gb DECIMAL(10,2),
    memory_total_mb INT,
    cpu_cores INT,
    
    -- Performance
    cpu_usage DECIMAL(5,2),
    memory_usage DECIMAL(5,2),
    disk_usage DECIMAL(5,2),
    temperature DECIMAL(4,1),
    load_average VARCHAR(20),
    
    -- Bot management
    running_bots JSON,
    max_concurrent_bots INT DEFAULT 5,
    bot_base_path VARCHAR(500) DEFAULT '/home/pi/bots',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_raspberry_status (status),
    INDEX idx_raspberry_heartbeat (last_heartbeat),
    INDEX idx_raspberry_ip (ip_address)
);

-- Bot process bilgileri
CREATE TABLE bot_processes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bot_id INT NOT NULL,
    raspberry_device_id INT NOT NULL,
    
    -- Process info
    process_id INT,
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP NULL,
    
    -- Performance
    cpu_usage DECIMAL(5,2),
    memory_usage_mb INT,
    uptime_seconds INT DEFAULT 0,
    
    -- Status
    status ENUM('starting', 'running', 'stopping', 'stopped', 'crashed') DEFAULT 'starting',
    exit_code INT NULL,
    restart_count INT DEFAULT 0,
    
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    FOREIGN KEY (raspberry_device_id) REFERENCES raspberry_devices(id) ON DELETE CASCADE,
    INDEX idx_processes_bot_id (bot_id),
    INDEX idx_processes_device_id (raspberry_device_id),
    INDEX idx_processes_status (status)
);

-- API anahtarları
CREATE TABLE api_keys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    key_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    
    -- Permissions
    permissions JSON,
    rate_limit_per_minute INT DEFAULT 60,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL,
    usage_count INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    INDEX idx_api_keys_profile (profile_id),
    INDEX idx_api_keys_active (is_active),
    INDEX idx_api_keys_key (api_key)
);

-- Webhook konfigürasyonları
CREATE TABLE webhooks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profile_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    url VARCHAR(500) NOT NULL,
    
    -- Configuration
    events JSON,
    headers JSON,
    secret VARCHAR(255),
    timeout_seconds INT DEFAULT 30,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_triggered_at TIMESTAMP NULL,
    success_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    INDEX idx_webhooks_profile (profile_id),
    INDEX idx_webhooks_active (is_active)
);

-- Scheduled tasks
CREATE TABLE scheduled_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Task details
    task_type ENUM('bot_restart', 'system_cleanup', 'backup', 'health_check', 'custom') NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    target_bot_id INT NULL,
    
    -- Configuration
    configuration JSON,
    max_runtime_seconds INT DEFAULT 3600,
    retry_attempts INT DEFAULT 3,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP NULL,
    next_run_at TIMESTAMP NULL,
    last_result ENUM('success', 'failure', 'timeout', 'cancelled') NULL,
    last_error_message TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (target_bot_id) REFERENCES bots(id) ON DELETE SET NULL,
    INDEX idx_tasks_active (is_active),
    INDEX idx_tasks_next_run (next_run_at),
    INDEX idx_tasks_type (task_type)
);

-- ============================================
-- Views
-- ============================================

-- Bot özet view
CREATE VIEW bot_summary AS
SELECT 
    b.id,
    b.name,
    b.display_name,
    b.status,
    b.last_ping,
    b.auto_restart,
    b.crash_count,
    b.restart_count,
    
    -- Son 24 saatteki ping sayısı
    (SELECT COUNT(*) FROM bot_status_history bsh 
     WHERE bsh.bot_id = b.id 
     AND bsh.timestamp > DATE_SUB(NOW(), INTERVAL 24 HOUR)) as ping_count_24h,
    
    -- Uptime yüzdesi (son 7 gün)
    COALESCE(
        (SELECT ROUND(
            (SUM(CASE WHEN status = 'online' THEN duration_seconds ELSE 0 END) * 100.0) / 
            NULLIF(SUM(duration_seconds), 0), 2
        ) FROM bot_status_history bsh 
         WHERE bsh.bot_id = b.id 
         AND bsh.timestamp > DATE_SUB(NOW(), INTERVAL 7 DAY)), 0
    ) as uptime_percentage_7d,
    
    -- Son crash zamanı
    (SELECT MAX(timestamp) FROM bot_status_history bsh 
     WHERE bsh.bot_id = b.id AND bsh.status = 'crashed') as last_crash_time,
     
    -- Aktif Raspberry Pi device
    (SELECT rd.name FROM raspberry_devices rd 
     JOIN bot_processes bp ON rd.id = bp.raspberry_device_id 
     WHERE bp.bot_id = b.id AND bp.status = 'running' 
     ORDER BY bp.start_time DESC LIMIT 1) as active_device

FROM bots b;

-- Profil özet view  
CREATE VIEW profile_summary AS
SELECT 
    p.id,
    p.name,
    p.role,
    p.is_active,
    p.last_login,
    p.login_count,
    
    -- İzinli bot sayısı
    (SELECT COUNT(*) FROM profile_bot_permissions pbp 
     WHERE pbp.profile_id = p.id) as accessible_bot_count,
     
    -- Okunmamış bildirim sayısı
    (SELECT COUNT(*) FROM notifications n 
     WHERE n.profile_id = p.id AND n.is_read = FALSE) as unread_notification_count,
     
    -- Son bildirim zamanı
    (SELECT MAX(created_at) FROM notifications n 
     WHERE n.profile_id = p.id) as last_notification_time

FROM profiles p;

-- ============================================
-- Stored Procedures
-- ============================================

DELIMITER //

-- Bot durum güncelleme procedure
CREATE PROCEDURE UpdateBotStatus(
    IN p_bot_name VARCHAR(255),
    IN p_status VARCHAR(20),
    IN p_message TEXT,
    IN p_source VARCHAR(20),
    IN p_cpu_usage DECIMAL(5,2),
    IN p_memory_usage DECIMAL(5,2)
)
BEGIN
    DECLARE v_bot_id INT;
    DECLARE v_previous_status VARCHAR(20);
    DECLARE v_duration INT DEFAULT 0;
    
    START TRANSACTION;
    
    -- Bot ID ve önceki durumu al
    SELECT id, status INTO v_bot_id, v_previous_status 
    FROM bots WHERE name = p_bot_name;
    
    IF v_bot_id IS NULL THEN
        -- Yeni bot oluştur
        INSERT INTO bots (name, status, last_ping, main_file) 
        VALUES (p_bot_name, p_status, NOW(), CONCAT(p_bot_name, '.js'));
        SET v_bot_id = LAST_INSERT_ID();
    ELSE
        -- Mevcut bot durumunu güncelle
        UPDATE bots 
        SET status = p_status, 
            last_ping = NOW(),
            crash_count = crash_count + (CASE WHEN p_status = 'crashed' THEN 1 ELSE 0 END),
            restart_count = restart_count + (CASE WHEN p_status = 'online' AND v_previous_status IN ('offline', 'crashed') THEN 1 ELSE 0 END)
        WHERE id = v_bot_id;
        
        -- Önceki durum ile aynı zamandaki süreyi hesapla
        SELECT COALESCE(TIMESTAMPDIFF(SECOND, timestamp, NOW()), 0) INTO v_duration
        FROM bot_status_history 
        WHERE bot_id = v_bot_id AND status = v_previous_status
        ORDER BY timestamp DESC LIMIT 1;
    END IF;
    
    -- Durum geçmişine kaydet
    INSERT INTO bot_status_history 
    (bot_id, status, previous_status, message, source, cpu_usage, memory_usage, duration_seconds) 
    VALUES 
    (v_bot_id, p_status, v_previous_status, p_message, p_source, p_cpu_usage, p_memory_usage, v_duration);
    
    COMMIT;
    
    SELECT v_bot_id as bot_id, v_previous_status as previous_status;
END //

-- Bildirim oluşturma procedure
CREATE PROCEDURE CreateNotification(
    IN p_profile_id INT,
    IN p_bot_id INT,
    IN p_title VARCHAR(255),
    IN p_message TEXT,
    IN p_type VARCHAR(20),
    IN p_priority VARCHAR(20)
)
BEGIN
    DECLARE v_notification_enabled BOOLEAN DEFAULT TRUE;
    
    -- Profil bildirim ayarını kontrol et
    SELECT notification_enabled INTO v_notification_enabled 
    FROM profiles WHERE id = p_profile_id;
    
    IF v_notification_enabled THEN
        INSERT INTO notifications 
        (profile_id, bot_id, title, message, type, priority) 
        VALUES 
        (p_profile_id, p_bot_id, p_title, p_message, p_type, p_priority);
    END IF;
END //

DELIMITER ;

-- ============================================
-- Triggers
-- ============================================

-- Bot status değişikliği trigger'ı
DELIMITER //
CREATE TRIGGER tr_bot_status_change 
AFTER UPDATE ON bots
FOR EACH ROW
BEGIN
    -- Eğer durum değiştiyse bildirim oluştur
    IF OLD.status != NEW.status THEN
        -- Tüm yetkili profillere bildirim gönder
        INSERT INTO notifications (profile_id, bot_id, title, message, type, priority)
        SELECT 
            pbp.profile_id,
            NEW.id,
            CONCAT('Bot Durum Değişikliği: ', NEW.name),
            CONCAT(NEW.name, ' botu ', OLD.status, ' durumundan ', NEW.status, ' durumuna geçti.'),
            CASE 
                WHEN NEW.status = 'crashed' THEN 'bot_crash'
                WHEN NEW.status = 'offline' THEN 'bot_offline'
                WHEN NEW.status = 'online' THEN 'bot_online'
                ELSE 'info'
            END,
            CASE 
                WHEN NEW.status = 'crashed' THEN 'high'
                WHEN NEW.status = 'offline' THEN 'medium'
                ELSE 'low'
            END
        FROM profile_bot_permissions pbp
        INNER JOIN profiles p ON pbp.profile_id = p.id
        WHERE pbp.bot_id = NEW.id 
        AND pbp.receive_notifications = TRUE 
        AND p.notification_enabled = TRUE;
    END IF;
END //
DELIMITER ;

-- ============================================
-- İndeksler ve Optimizasyonlar
-- ============================================

-- Performans için ek indeksler
CREATE INDEX idx_bot_status_history_composite ON bot_status_history(bot_id, timestamp, status);
CREATE INDEX idx_notifications_composite ON notifications(profile_id, is_read, created_at);
CREATE INDEX idx_bot_files_composite ON bot_files(bot_id, file_type, last_modified);

-- ============================================
-- İlk Veriler
-- ============================================

-- Admin profili oluştur
INSERT INTO profiles (name, description, access_key, role) VALUES 
('Administrator', 'System Administrator Profile', SHA2(CONCAT('admin_', NOW(), RAND()), 256), 'admin');

-- Örnek bot kayıtları
INSERT INTO bots (name, display_name, description, main_file, vds_path, raspberry_path) VALUES 
('discord-music-bot', 'Music Bot', 'Discord müzik botu', 'index.js', '/root/bots/music-bot', '/home/pi/bots/music-bot'),
('moderation-bot', 'Moderation Bot', 'Sunucu moderasyon botu', 'bot.js', '/root/bots/mod-bot', '/home/pi/bots/mod-bot'),
('economy-bot', 'Economy Bot', 'Ekonomi sistemi botu', 'main.js', '/root/bots/economy-bot', '/home/pi/bots/economy-bot');

-- Admin profiline tüm botlar için full izin ver
INSERT INTO profile_bot_permissions (profile_id, bot_id, can_view, can_edit, can_start_stop, can_restart, can_delete, can_view_logs, can_edit_files, can_manage_settings)
SELECT 1, id, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE FROM bots;

-- Sistem log kaydı
INSERT INTO system_logs (log_level, message, component) VALUES 
('info', 'Database schema initialized successfully', 'database');

-- ============================================
-- Kullanıcı ve İzinler
-- ============================================

-- Bot Management System kullanıcısı oluştur
CREATE USER IF NOT EXISTS 'bot_manager'@'localhost' IDENTIFIED BY 'BotManager2024!';
CREATE USER IF NOT EXISTS 'bot_manager'@'%' IDENTIFIED BY 'BotManager2024!';

-- İzinleri ver
GRANT ALL PRIVILEGES ON bot_management_system.* TO 'bot_manager'@'localhost';
GRANT ALL PRIVILEGES ON bot_management_system.* TO 'bot_manager'@'%';

-- Read-only kullanıcı
CREATE USER IF NOT EXISTS 'bot_reader'@'localhost' IDENTIFIED BY 'BotReader2024!';
GRANT SELECT ON bot_management_system.* TO 'bot_reader'@'localhost';

FLUSH PRIVILEGES;

-- ============================================
-- Maintenance ve Cleanup
-- ============================================

-- Eski kayıtları temizleme eventi
DELIMITER //
CREATE EVENT ev_cleanup_old_logs
ON SCHEDULE EVERY 1 DAY
STARTS CURRENT_TIMESTAMP
DO
BEGIN
    -- 30 günden eski status history kayıtlarını sil
    DELETE FROM bot_status_history 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 30 DAY);
    
    -- 7 günden eski info level system log'ları sil
    DELETE FROM system_logs 
    WHERE timestamp < DATE_SUB(NOW(), INTERVAL 7 DAY) 
    AND log_level = 'info';
    
    -- 30 günden eski okunmuş bildirimleri sil
    DELETE FROM notifications 
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) 
    AND is_read = TRUE;
    
    -- Cleanup log'u yaz
    INSERT INTO system_logs (log_level, message, component) 
    VALUES ('info', 'Automated cleanup completed', 'database');
END //
DELIMITER ;

-- Event scheduler'ı aktifleştir
SET GLOBAL event_scheduler = ON;

-- ============================================
-- Final Checks
-- ============================================

-- Tablo sayısını göster
SELECT 
    COUNT(*) as table_count,
    'Database schema created successfully' as status
FROM information_schema.tables 
WHERE table_schema = 'bot_management_system';

-- İndeks sayısını göster
SELECT 
    COUNT(*) as index_count
FROM information_schema.statistics 
WHERE table_schema = 'bot_management_system';

SELECT 'Database setup completed successfully!' as result;