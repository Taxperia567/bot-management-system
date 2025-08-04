#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import json
import requests
import sys
from pathlib import Path

class BotManagerCLI:
    """Bot Manager komut satırı arayüzü"""
    
    def __init__(self):
        self.base_url = "http://localhost:3001/api"
    
    def list_bots(self):
        """Botları listele"""
        try:
            response = requests.get(f"{self.base_url}/bots")
            response.raise_for_status()
            
            bots = response.json()
            
            print(f"{'Bot Adı':<20} {'Durum':<15} {'Son Ping':<20} {'PID':<8}")
            print("-" * 70)
            
            for bot in bots:
                last_ping = bot.get('last_ping', 'Hiç')
                if last_ping and last_ping != 'Hiç':
                    last_ping = last_ping[:19]  # Tarihi kısalt
                
                print(f"{bot['name']:<20} {bot['status']:<15} {last_ping:<20} {bot.get('pid', 'N/A'):<8}")
            
            print(f"\nToplam: {len(bots)} bot")
            
        except Exception as e:
            print(f"Hata: {e}")
            return False
        
        return True
    
    def bot_status(self, bot_name):
        """Bot durumunu göster"""
        try:
            response = requests.get(f"{self.base_url}/bots")
            response.raise_for_status()
            
            bots = response.json()
            bot = next((b for b in bots if b['name'] == bot_name), None)
            
            if not bot:
                print(f"Bot bulunamadı: {bot_name}")
                return False
            
            print(f"Bot Adı: {bot['name']}")
            print(f"Durum: {bot['status']}")
            print(f"Ana Dosya: {bot.get('main_file', 'Belirtilmemiş')}")
            print(f"Son Ping: {bot.get('last_ping', 'Hiç')}")
            print(f"Oluşturulma: {bot.get('created_at', 'Bilinmiyor')}")
            
            if bot.get('description'):
                print(f"Açıklama: {bot['description']}")
            
        except Exception as e:
            print(f"Hata: {e}")
            return False
        
        return True
    
    def control_bot(self, bot_name, action):
        """Bot kontrolü"""
        try:
            # Önce bot ID'sini bul
            response = requests.get(f"{self.base_url}/bots")
            response.raise_for_status()
            
            bots = response.json()
            bot = next((b for b in bots if b['name'] == bot_name), None)
            
            if not bot:
                print(f"Bot bulunamadı: {bot_name}")
                return False
            
            # Kontrol komutunu gönder
            response = requests.post(f"{self.base_url}/bot/{bot['id']}/control", json={
                'action': action,
                'source': 'cli'
            })
            response.raise_for_status()
            
            result = response.json()
            if result.get('success'):
                print(f"Başarılı: {result.get('message', 'Komut gönderildi')}")
            else:
                print(f"Hata: {result.get('error', 'Bilinmeyen hata')}")
            
        except Exception as e:
            print(f"Hata: {e}")
            return False
        
        return True
    
    def show_logs(self, lines=50):
        """Log dosyasını göster"""
        try:
            log_file = Path('/var/log/bot_manager.log')
            if not log_file.exists():
                print("Log dosyası bulunamadı")
                return False
            
            # Son N satırı göster
            with open(log_file, 'r') as f:
                all_lines = f.readlines()
                last_lines = all_lines[-lines:]
                
            for line in last_lines:
                print(line.rstrip())
            
        except Exception as e:
            print(f"Hata: {e}")
            return False
        
        return True


def main():
    """Ana fonksiyon"""
    parser = argparse.ArgumentParser(description='Bot Manager CLI')
    subparsers = parser.add_subparsers(dest='command', help='Komutlar')
    
    # List komutu
    subparsers.add_parser('list', help='Botları listele')
    
    # Status komutu
    status_parser = subparsers.add_parser('status', help='Bot durumunu göster')
    status_parser.add_argument('bot_name', help='Bot adı')
    
    # Start komutu
    start_parser = subparsers.add_parser('start', help='Bot başlat')
    start_parser.add_argument('bot_name', help='Bot adı')
    
    # Stop komutu
    stop_parser = subparsers.add_parser('stop', help='Bot durdur')
    stop_parser.add_argument('bot_name', help='Bot adı')
    
    # Restart komutu
    restart_parser = subparsers.add_parser('restart', help='Bot yeniden başlat')
    restart_parser.add_argument('bot_name', help='Bot adı')
    
    # Logs komutu
    logs_parser = subparsers.add_parser('logs', help='Logları göster')
    logs_parser.add_argument('--lines', '-n', type=int, default=50, help='Gösterilecek satır sayısı')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    cli = BotManagerCLI()
    
    if args.command == 'list':
        cli.list_bots()
    elif args.command == 'status':
        cli.bot_status(args.bot_name)
    elif args.command == 'start':
        cli.control_bot(args.bot_name, 'start')
    elif args.command == 'stop':
        cli.control_bot(args.bot_name, 'stop')
    elif args.command == 'restart':
        cli.control_bot(args.bot_name, 'restart')
    elif args.command == 'logs':
        cli.show_logs(args.lines)


if __name__ == '__main__':
    main()