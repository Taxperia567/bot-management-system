#!/bin/bash

# Bot Manager başlatma scripti

echo "Bot Manager başlatılıyor..."

# Gerekli klasörlerin varlığını kontrol et
if [ ! -d "/home/pi/bots" ]; then
    echo "Bot klasörü oluşturuluyor..."
    mkdir -p /home/pi/bots
fi

if [ ! -d "/etc/bot_manager" ]; then
    echo "Yapılandırma klasörü oluşturuluyor..."
    sudo mkdir -p /etc/bot_manager
    sudo chown pi:pi /etc/bot_manager
fi

# Yapılandırma dosyasının varlığını kontrol et
if [ ! -f "/etc/bot_manager/config.ini" ]; then
    echo "Varsayılan yapılandırma oluşturuluyor..."
    cp config.ini /etc/bot_manager/config.ini
fi

# Log dosyasının varlığını kontrol et
if [ ! -f "/var/log/bot_manager.log" ]; then
    echo "Log dosyası oluşturuluyor..."
    sudo touch /var/log/bot_manager.log
    sudo chown pi:pi /var/log/bot_manager.log
fi

# Python paketlerinin kurulu olup olmadığını kontrol et
python3 -c "import psutil, requests, socketio, watchdog" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Gerekli Python paketleri kuruluyor..."
    pip3 install -r requirements.txt
fi

# Bot Manager'ı başlat
echo "Bot Manager başlatılıyor..."
python3 bot_manager.py