#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import json
import time
import signal
import logging
import threading
import subprocess
import psutil
import requests
import socketio
from pathlib import Path
from datetime import datetime
from configparser import ConfigParser
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import hashlib

# Loglama yapılandırması
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/bot_manager.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('BotManager')

class BotProcess:
    """Bot süreç yönetimi sınıfı"""
    
    def __init__(self, name, script_path, working_dir):
        self.name = name
        self.script_path = script_path
        self.working_dir = working_dir
        self.process = None
        self.last_start = None
        self.restart_count = 0
        self.status = 'stopped'
        
    def start(self):
        """Bot'u başlat"""
        try:
            if self.is_running():
                logger.warning(f"{self.name} zaten çalışıyor")
                return False
                
            logger.info(f"{self.name} başlatılıyor...")
            
            # Node.js süreci başlat
            self.process = subprocess.Popen(
                ['node', self.script_path],
                cwd=self.working_dir,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                preexec_fn=os.setsid
            )
            
            self.last_start = datetime.now()
            self.restart_count += 1
            self.status = 'running'
            
            logger.info(f"{self.name} başlatıldı (PID: {self.process.pid})")
            return True
            
        except Exception as e:
            logger.error(f"{self.name} başlatma hatası: {e}")
            self.status = 'failed'
            return False
    
    def stop(self):
        """Bot'u durdur"""
        try:
            if not self.is_running():
                logger.warning(f"{self.name} zaten durmuş")
                return True
                
            logger.info(f"{self.name} durduruluyor...")
            
            # Süreç grubunu sonlandır
            os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            
            # 5 saniye bekle
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                # Zorla sonlandır
                os.killpg(os.getpgid(self.process.pid), signal.SIGKILL)
                self.process.wait()
            
            self.status = 'stopped'
            logger.info(f"{self.name} durduruldu")
            return True
            
        except Exception as e:
            logger.error(f"{self.name} durdurma hatası: {e}")
            return False
    
    def restart(self):
        """Bot'u yeniden başlat"""
        logger.info(f"{self.name} yeniden başlatılıyor...")
        self.stop()
        time.sleep(2)
        return self.start()
    
    def is_running(self):
        """Bot çalışıyor mu kontrol et"""
        if self.process is None:
            return False
            
        return self.process.poll() is None
    
    def get_status(self):
        """Bot durumunu getir"""
        if self.is_running():
            self.status = 'running'
        elif self.status == 'running':
            self.status = 'crashed'
            
        return {
            'name': self.name,
            'status': self.status,
            'pid': self.process.pid if self.is_running() else None,
            'last_start': self.last_start.isoformat() if self.last_start else None,
            'restart_count': self.restart_count,
            'uptime': self._get_uptime()
        }
    
    def _get_uptime(self):
        """Çalışma süresini hesapla"""
        if not self.is_running() or not self.last_start:
            return 0
        return (datetime.now() - self.last_start).total_seconds()


class FileWatcher(FileSystemEventHandler):
    """Dosya değişikliklerini izleyen sınıf"""
    
    def __init__(self, bot_manager):
        self.bot_manager = bot_manager
        
    def on_modified(self, event):
        if not event.is_directory and event.src_path.endswith('.js'):
            logger.info(f"Dosya değişti: {event.src_path}")
            # İlgili bot'u yeniden başlat
            bot_name = self._get_bot_name_from_path(event.src_path)
            if bot_name and bot_name in self.bot_manager.bots:
                logger.info(f"{bot_name} dosya değişikliği nedeniyle yeniden başlatılıyor")
                self.bot_manager.restart_bot(bot_name)
    
    def _get_bot_name_from_path(self, file_path):
        """Dosya yolundan bot adını çıkar"""
        try:
            path_parts = Path(file_path).parts
            for i, part in enumerate(path_parts):
                if part == 'bots' and i + 1 < len(path_parts):
                    return path_parts[i + 1]
        except Exception:
            pass
        return None


class BotManager:
    """Ana bot yönetim sınıfı"""
    
    def __init__(self, config_path='/etc/bot_manager/config.ini'):
        self.config_path = config_path
        self.config = ConfigParser()
        self.bots = {}
        self.running = False
        self.sio = None
        self.observer = None
        
        # Yapılandırmayı yükle
        self.load_config()
        
        # Socket.IO istemcisini başlat
        self.setup_socketio()
        
        # Dosya izleyicisini başlat
        self.setup_file_watcher()
        
        # Signal handler'ları ayarla
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
    
    def load_config(self):
        """Yapılandırmayı yükle"""
        try:
            self.config.read(self.config_path)
            
            # Varsayılan değerler
            self.server_url = self.config.get('server', 'url', fallback='http://localhost:3001')
            self.bots_directory = self.config.get('bot', 'directory', fallback='/home/pi/bots')
            self.auto_restart = self.config.getboolean('bot', 'auto_restart', fallback=True)
            self.heartbeat_interval = self.config.getint('system', 'heartbeat_interval', fallback=30)
            self.raspberry_name = self.config.get('system', 'name', fallback='RaspberryPi-01')
            
            logger.info(f"Yapılandırma yüklendi: {self.config_path}")
            
        except Exception as e:
            logger.error(f"Yapılandırma yükleme hatası: {e}")
            # Varsayılan değerlerle devam et
            self.server_url = 'http://localhost:3001'
            self.bots_directory = '/home/pi/bots'
            self.auto_restart = True
            self.heartbeat_interval = 30
            self.raspberry_name = 'RaspberryPi-01'
    
    def setup_socketio(self):
        """Socket.IO bağlantısını kur"""
        try:
            self.sio = socketio.Client()
            
            @self.sio.event
            def connect():
                logger.info("Sunucuya bağlandı")
                self.sio.emit('register', {
                    'type': 'raspberry',
                    'name': self.raspberry_name
                })
            
            @self.sio.event
            def disconnect():
                logger.warning("Sunucu bağlantısı kesildi")
            
            @self.sio.event
            def botControl(data):
                logger.info(f"Bot kontrol komutu alındı: {data}")
                self.handle_bot_control(data)
            
            @self.sio.event
            def fileUpdate(data):
                logger.info(f"Dosya güncelleme sinyali alındı: {data}")
                self.sync_bot_files(data.get('botId'))
            
            # Sunucuya bağlan
            self.sio.connect(self.server_url)
            
        except Exception as e:
            logger.error(f"Socket.IO kurulum hatası: {e}")
    
    def setup_file_watcher(self):
        """Dosya izleyicisini kur"""
        try:
            if os.path.exists(self.bots_directory):
                self.observer = Observer()
                event_handler = FileWatcher(self)
                self.observer.schedule(event_handler, self.bots_directory, recursive=True)
                self.observer.start()
                logger.info(f"Dosya izleyici başlatıldı: {self.bots_directory}")
            else:
                logger.warning(f"Bot klasörü bulunamadı: {self.bots_directory}")
                
        except Exception as e:
            logger.error(f"Dosya izleyici kurulum hatası: {e}")
    
    def discover_bots(self):
        """Bot klasöründeki botları keşfet"""
        try:
            bots_path = Path(self.bots_directory)
            if not bots_path.exists():
                logger.warning(f"Bot klasörü bulunamadı: {self.bots_directory}")
                return
            
            for bot_dir in bots_path.iterdir():
                if bot_dir.is_dir():
                    # Ana dosyayı bul
                    main_files = [
                        'index.js', 'main.js', 'bot.js', f'{bot_dir.name}.js'
                    ]
                    
                    main_file = None
                    for file_name in main_files:
                        file_path = bot_dir / file_name
                        if file_path.exists():
                            main_file = file_path
                            break
                    
                    if main_file:
                        bot = BotProcess(
                            name=bot_dir.name,
                            script_path=str(main_file),
                            working_dir=str(bot_dir)
                        )
                        self.bots[bot_dir.name] = bot
                        logger.info(f"Bot keşfedildi: {bot_dir.name}")
            
            logger.info(f"Toplam {len(self.bots)} bot keşfedildi")
            
        except Exception as e:
            logger.error(f"Bot keşfi hatası: {e}")
    
    def start_bot(self, bot_name):
        """Bot'u başlat"""
        if bot_name not in self.bots:
            logger.error(f"Bot bulunamadı: {bot_name}")
            return False
        
        return self.bots[bot_name].start()
    
    def stop_bot(self, bot_name):
        """Bot'u durdur"""
        if bot_name not in self.bots:
            logger.error(f"Bot bulunamadı: {bot_name}")
            return False
        
        return self.bots[bot_name].stop()
    
    def restart_bot(self, bot_name):
        """Bot'u yeniden başlat"""
        if bot_name not in self.bots:
            logger.error(f"Bot bulunamadı: {bot_name}")
            return False
        
        return self.bots[bot_name].restart()
    
    def handle_bot_control(self, data):
        """Bot kontrol komutunu işle"""
        try:
            bot_name = data.get('botName')
            action = data.get('action')
            
            if not bot_name or not action:
                logger.error("Eksik bot kontrol verisi")
                return
            
            if action == 'start':
                result = self.start_bot(bot_name)
            elif action == 'stop':
                result = self.stop_bot(bot_name)
            elif action == 'restart':
                result = self.restart_bot(bot_name)
            else:
                logger.error(f"Bilinmeyen aksiyon: {action}")
                return
            
            logger.info(f"Bot kontrol sonucu - {bot_name}: {action} -> {result}")
            
        except Exception as e:
            logger.error(f"Bot kontrol hatası: {e}")
    
    def sync_bot_files(self, bot_id):
        """Bot dosyalarını sunucudan senkronize et"""
        try:
            # Sunucudan bot bilgilerini al
            response = requests.get(f"{self.server_url}/api/bot/{bot_id}")
            if response.status_code != 200:
                logger.error(f"Bot bilgileri alınamadı: {bot_id}")
                return
            
            bot_data = response.json()
            bot_name = bot_data['bot']['name']
            files = bot_data.get('files', [])
            
            if not files:
                logger.warning(f"Bot için dosya bulunamadı: {bot_name}")
                return
            
            # Bot klasörünü oluştur
            bot_dir = Path(self.bots_directory) / bot_name
            bot_dir.mkdir(exist_ok=True)
            
            # Dosyaları güncelle
            for file_data in files:
                file_path = bot_dir / file_data['file_name']
                
                # Mevcut dosyanın hash'ini kontrol et
                current_hash = None
                if file_path.exists():
                    with open(file_path, 'r', encoding='utf-8') as f:
                        current_content = f.read()
                        current_hash = hashlib.sha256(current_content.encode()).hexdigest()
                
                # Hash farklıysa dosyayı güncelle
                if current_hash != file_data.get('file_hash'):
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(file_data['file_content'])
                    
                    logger.info(f"Dosya güncellendi: {file_path}")
            
            # Bot'u yeniden keşfet ve yeniden başlat
            if bot_name in self.bots:
                self.restart_bot(bot_name)
            else:
                self.discover_bots()
                if bot_name in self.bots:
                    self.start_bot(bot_name)
            
            logger.info(f"Bot senkronizasyonu tamamlandı: {bot_name}")
            
        except Exception as e:
            logger.error(f"Dosya senkronizasyonu hatası: {e}")
    
    def get_system_stats(self):
        """Sistem istatistiklerini getir"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Çalışan bot listesi
            running_bots = []
            for bot_name, bot in self.bots.items():
                if bot.is_running():
                    running_bots.append(bot_name)
            
            return {
                'name': self.raspberry_name,
                'ip_address': self._get_local_ip(),
                'cpu_usage': cpu_percent,
                'memory_usage': memory.percent,
                'disk_usage': disk.percent,
                'running_bots': running_bots,
                'total_bots': len(self.bots),
                'uptime': self._get_system_uptime()
            }
            
        except Exception as e:
            logger.error(f"Sistem istatistikleri hatası: {e}")
            return {}
    
    def _get_local_ip(self):
        """Yerel IP adresini getir"""
        try:
            import socket
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return 'Unknown'
    
    def _get_system_uptime(self):
        """Sistem çalışma süresini getir"""
        try:
            with open('/proc/uptime', 'r') as f:
                uptime_seconds = float(f.readline().split()[0])
                return uptime_seconds
        except Exception:
            return 0
    
    def send_heartbeat(self):
        """Sunucuya heartbeat gönder"""
        try:
            stats = self.get_system_stats()
            
            if self.sio and self.sio.connected:
                # Socket.IO ile gönder
                self.sio.emit('raspberry_heartbeat', stats)
            else:
                # HTTP ile gönder
                response = requests.post(
                    f"{self.server_url}/api/raspberry/heartbeat",
                    json=stats,
                    timeout=10
                )
                if response.status_code == 200:
                    logger.debug("Heartbeat gönderildi")
                else:
                    logger.warning(f"Heartbeat hatası: {response.status_code}")
            
        except Exception as e:
            logger.error(f"Heartbeat gönderme hatası: {e}")
    
    def monitor_bots(self):
        """Botları izle ve gerekirse yeniden başlat"""
        try:
            for bot_name, bot in self.bots.items():
                if not bot.is_running() and bot.status == 'running':
                    # Bot çökmüş
                    bot.status = 'crashed'
                    logger.warning(f"Bot çöktü: {bot_name}")
                    
                    # Otomatik yeniden başlatma
                    if self.auto_restart:
                        logger.info(f"Bot otomatik yeniden başlatılıyor: {bot_name}")
                        bot.restart()
                        
                        # Sunucuya bildir
                        if self.sio and self.sio.connected:
                            self.sio.emit('bot_crashed', {
                                'botName': bot_name,
                                'action': 'auto_restart',
                                'timestamp': datetime.now().isoformat()
                            })
            
        except Exception as e:
            logger.error(f"Bot izleme hatası: {e}")
    
    def start(self):
        """Bot manager'ı başlat"""
        logger.info("Bot Manager başlatılıyor...")
        self.running = True
        
        # Botları keşfet
        self.discover_bots()
        
        # Heartbeat thread'ini başlat
        heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        
        # Bot izleme thread'ini başlat
        monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        monitor_thread.start()
        
        logger.info("Bot Manager başlatıldı")
        
        # Ana döngü
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Klavye kesintisi alındı")
        finally:
            self.stop()
    
    def stop(self):
        """Bot manager'ı durdur"""
        logger.info("Bot Manager durduruluyor...")
        self.running = False
        
        # Tüm botları durdur
        for bot_name, bot in self.bots.items():
            if bot.is_running():
                logger.info(f"Bot durduruluyor: {bot_name}")
                bot.stop()
        
        # Dosya izleyiciyi durdur
        if self.observer:
            self.observer.stop()
            self.observer.join()
        
        # Socket.IO bağlantısını kapat
        if self.sio:
            self.sio.disconnect()
        
        logger.info("Bot Manager durduruldu")
    
    def _heartbeat_loop(self):
        """Heartbeat döngüsü"""
        while self.running:
            try:
                self.send_heartbeat()
                time.sleep(self.heartbeat_interval)
            except Exception as e:
                logger.error(f"Heartbeat döngü hatası: {e}")
                time.sleep(5)
    
    def _monitor_loop(self):
        """Bot izleme döngüsü"""
        while self.running:
            try:
                self.monitor_bots()
                time.sleep(10)  # 10 saniyede bir kontrol et
            except Exception as e:
                logger.error(f"Monitor döngü hatası: {e}")
                time.sleep(5)
    
    def _signal_handler(self, signum, frame):
        """Signal handler"""
        logger.info(f"Signal alındı: {signum}")
        self.running = False


def main():
    """Ana fonksiyon"""
    try:
        # Yapılandırma dosyasını kontrol et
        config_path = '/etc/bot_manager/config.ini'
        if not os.path.exists(config_path):
            # Varsayılan yapılandırma oluştur
            os.makedirs('/etc/bot_manager', exist_ok=True)
            with open(config_path, 'w') as f:
                f.write("""[server]
url = http://localhost:3001

[bot]
directory = /home/pi/bots
auto_restart = true

[system]
heartbeat_interval = 30
name = RaspberryPi-01
""")
            logger.info(f"Varsayılan yapılandırma oluşturuldu: {config_path}")
        
        # Bot manager'ı başlat
        bot_manager = BotManager(config_path)
        bot_manager.start()
        
    except Exception as e:
        logger.error(f"Ana fonksiyon hatası: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()