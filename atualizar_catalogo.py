"""
IZZAT CAR - Atualizador do Catálogo do Site
Puxa TODOS os anúncios do ML e gera o arquivo products.json
Rodar sempre que quiser atualizar o site com anúncios novos.
"""

import requests
import json
import os
import time
from pathlib import Path
from dotenv import load_dotenv

# Carregar token
env_path = Path(r"C:\Users\Administrator\Desktop\IzzatCar\MercadoLivre\.env")
load_dotenv(env_path)
TOKEN = os.getenv("ML_ACCESS_TOKEN")
SELLER_ID = "2932888131"
SITE_DIR = Path(r"C:\Users\Administrator\Desktop\IzzatCar\site")

headers = {"Authorization": f"Bearer {TOKEN}"}

def refresh_token():
    """Tenta renovar o token se expirado."""
    refresh = os.getenv("REFRESH_TOKEN")
    app_id = os.getenv("APP_ID", "5532196899096674")
    client_secret = os.getenv("CLIENT_SECRET")
    if not refresh or not client_secret:
        print("⚠ Sem REFRESH_TOKEN ou CLIENT_SECRET no .env")
        return None
    resp = requests.post("https://api.mercadolibre.com/oauth/token", json={
        "grant_type": "refresh_token",
        "client_id": app_id,
        "client_secret": client_secret,
        "refresh_token": refresh
    })
    if resp.status_code == 200:
        data = resp.json()
        new_token = data["access_token"]
        # Atualizar .env
        env_content = env_path.read_text()
        env_content = env_content.replace(TOKEN, new_token)
        if "REFRESH_TOKEN" in env_content:
            old_refresh = refresh
            env_content = env_content.replace(old_refresh, data.get("refresh_token", old_refresh))
        env_path.write_text(env_content)
        print("✅ Token renovado!")
        return new_token
    print(f"❌ Erro ao renovar token: {resp.status_code}")
    return None

def get_all_item_ids():
    """Busca todos os IDs de anúncios ativos."""
    print("📦 Buscando IDs dos anúncios...")
    ids = []
    offset = 0
    limit = 100
    while True:
        url = f"https://api.mercadolibre.com/users/{SELLER_ID}/items/search?status=active&limit={limit}&offset={offset}"
        resp = requests.get(url, headers=headers)
        if resp.status_code == 401:
            new_token = refresh_token()
            if new_token:
                headers["Authorization"] = f"Bearer {new_token}"
                continue
            else:
                break
        data = resp.json()
        batch = data.get("results", [])
        ids.extend(batch)
        total = data.get("paging", {}).get("total", 0)
        offset += len(batch)
        print(f"  {offset}/{total} IDs...")
        if offset >= total or not batch or offset >= 10000:
            break
        if offset >= 1000:
            # ML limita search a 1000, usar scroll
            url2 = f"https://api.mercadolibre.com/users/{SELLER_ID}/items/search?status=active&limit={limit}&offset={offset}&search_type=scan"
            resp2 = requests.get(url2, headers=headers)
            if resp2.status_code == 200:
                data2 = resp2.json()
                batch2 = data2.get("results", [])
                if not batch2:
                    break
                ids.extend(batch2)
                offset += len(batch2)
                print(f"  {offset}/{total} IDs (scan)...")
                time.sleep(0.3)
                continue
            break
        time.sleep(0.2)
    print(f"✅ {len(ids)} IDs encontrados")
    return ids

def get_items_details(ids):
    """Busca detalhes dos itens em lotes de 20."""
    print("📋 Buscando detalhes dos anúncios...")
    products = []
    for i in range(0, len(ids), 20):
        batch = ids[i:i+20]
        batch_str = ",".join(batch)
        url = f"https://api.mercadolibre.com/items?ids={batch_str}"
        resp = requests.get(url, headers=headers)
        if resp.status_code == 401:
            new_token = refresh_token()
            if new_token:
                headers["Authorization"] = f"Bearer {new_token}"
                resp = requests.get(url, headers=headers)
        if resp.status_code == 200:
            items = resp.json()
            for item_wrapper in items:
                item = item_wrapper.get("body", {})
                if not item or item.get("status") != "active":
                    continue

                # Pegar melhor imagem
                img = ""
                if item.get("pictures") and len(item["pictures"]) > 0:
                    img = item["pictures"][0].get("secure_url", "")
                elif item.get("thumbnail"):
                    img = item["thumbnail"].replace("http:", "https:")

                # Imagem grande
                if "-I.jpg" in img:
                    img = img.replace("-I.jpg", "-O.webp")
                elif "-I.webp" in img:
                    img = img.replace("-I.webp", "-O.webp")

                # Extrair marca do título
                brand = ""
                brands_list = [
                    "Volkswagen", "VW", "Chevrolet", "GM", "Fiat", "Ford", "Toyota",
                    "Honda", "Hyundai", "Renault", "Citroën", "Citroen", "Peugeot",
                    "Nissan", "Kia", "Jeep", "BMW", "Mercedes", "Audi", "Volvo",
                    "Jaguar", "Land Rover", "Mitsubishi", "Subaru", "Suzuki", "Chery", "Lifan"
                ]
                title_lower = item.get("title", "").lower()
                for b in brands_list:
                    if b.lower() in title_lower:
                        brand = b
                        break

                product = {
                    "id": item.get("id", ""),
                    "title": item.get("title", ""),
                    "price": item.get("price", 0),
                    "currency": item.get("currency_id", "BRL"),
                    "img": img,
                    "url": item.get("permalink", ""),
                    "free_shipping": item.get("shipping", {}).get("free_shipping", False),
                    "condition": item.get("condition", ""),
                    "sold": item.get("sold_quantity", 0),
                    "brand": brand,
                    "available": item.get("available_quantity", 0),
                }
                products.append(product)

        done = min(i + 20, len(ids))
        print(f"  {done}/{len(ids)} detalhes...")
        time.sleep(0.3)  # Rate limit

    print(f"✅ {len(products)} produtos processados")
    return products

def save_products(products):
    """Salva o JSON do catálogo."""
    output = SITE_DIR / "products.json"

    # Ordenar por mais vendidos primeiro
    products.sort(key=lambda x: x.get("sold", 0), reverse=True)

    data = {
        "total": len(products),
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "products": products
    }

    with open(output, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)

    size_mb = output.stat().st_size / 1024 / 1024
    print(f"✅ Salvo em {output}")
    print(f"   {len(products)} produtos | {size_mb:.1f} MB")

def main():
    print("=" * 50)
    print("  IZZAT CAR — Atualizador de Catálogo")
    print("=" * 50)
    print()

    ids = get_all_item_ids()
    if not ids:
        print("❌ Nenhum anúncio encontrado. Verifique o token.")
        return

    products = get_items_details(ids)
    save_products(products)

    print()
    print("🎉 PRONTO! O site já vai mostrar os anúncios atualizados.")
    print("   Rode este script sempre que quiser atualizar o catálogo.")

if __name__ == "__main__":
    main()
